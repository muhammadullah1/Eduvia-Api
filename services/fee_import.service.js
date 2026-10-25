"use strict";

/**
 * Offline sync (P1-08, Finance Step 7): Excel fee import in two calls.
 *
 * 1. validate: parse the workbook, check every rule for every row (required
 *    fields, student enrolled, class, month format and ledger, amount, date,
 *    method, duplicate receipts inside the file and against existing payments)
 *    and store the batch + its rows. Nothing else is written.
 * 2. commit: claimed once per Idempotency-Key, then every Valid row is recorded
 *    in its own transaction through the counter allocator (oldest bill first,
 *    excess becomes student credit, never future months), with idempotency key
 *    `import:{school}:{receipt}`, so a re-uploaded file only produces skipped rows.
 *
 * Accountants see their own batches and counts only (no money totals).
 */
const crypto = require("crypto");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { Op, QueryTypes } = require("sequelize");
const { FeeImportBatches, FeeImportRows, FeePayments, Students, Classes, StudentFeeMonths, Users, sequelize } = require("../models");
const { USER_ROLES, STUDENT_STATUS } = require("../constants");
const { can } = require("../constants/permissions");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const feeService = require("./fee.service");
const { today } = require("../utils/dates");
const { xlsxHeader, xlsxHeadRow } = require("../utils/branded_document");

const MAX_FILE_BYTES = 700 * 1024; // stays under the 1 MB JSON body limit once base64-encoded
const MAX_ROWS = 1000;
const MAX_AMOUNT = 10000000;
const METHODS = { cash: "Cash", "bank transfer": "BankTransfer", banktransfer: "BankTransfer", bank: "BankTransfer", cheque: "Cheque", check: "Cheque", online: "Online" };
const METHOD_LABELS = "Cash, Bank Transfer, Cheque, Online";
const ENROLLED = [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PENDING];

/** Template / importer columns. `keys` are accepted header spellings (lower case). */
const COLUMNS = {
  admissionNo: { label: "Admission Number", required: true, keys: ["admission number", "admission no", "admission no.", "student id"] },
  studentName: { label: "Student Name", keys: ["student name", "name"] },
  className: { label: "Class", keys: ["class"] },
  months: { label: "Month(s)", required: true, keys: ["month(s)", "month", "months"] },
  amount: { label: "Amount", required: true, keys: ["amount", "amount (pkr)"] },
  paymentDate: { label: "Payment Date", required: true, keys: ["payment date", "date"] },
  reference: { label: "Receipt/Reference No.", required: true, keys: ["receipt/reference no.", "receipt/reference no", "receipt/reference", "receipt or reference", "receipt ref", "receipt no", "receipt", "reference"] },
  method: { label: "Payment Method", keys: ["payment method", "method"] },
  notes: { label: "Notes", keys: ["notes", "note"] },
};
const TEMPLATE_COLUMNS = Object.values(COLUMNS).map((c) => c.label);
const HEADER_SCAN = 25;
const ADMISSION_KEYS = new Set(COLUMNS.admissionNo.keys);

const normKey = (v) => String(v ?? "").trim().toLowerCase();
const text = (v) => (v instanceof Date ? v.toISOString() : String(v ?? "").trim());
const squash = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isAccountant = (actor) => actor.role === USER_ROLES.ACCOUNTANT;
const seesTotals = (actor) => can(actor.role, "fees.totals");

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function realDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return ymd(value);
  const t = text(value);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
}

function monthOf(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return ymd(value).slice(0, 7);
  const t = text(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(t) ? t : null;
}

function amountOf(value) {
  if (typeof value === "number") return value;
  const t = text(value).replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Excel / CSV formula injection: a cell that starts with = + - @ (or a control char) is made literal. */
function safeCell(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function checkFile({ fileName, contentBase64 }) {
  if (!fileName || !/\.(xlsx|xls)$/i.test(fileName)) throw new ApiError(400, "Upload an Excel file (.xlsx or .xls).");
  const buffer = Buffer.from(String(contentBase64 || ""), "base64");
  if (!buffer.length) throw new ApiError(400, "The file is empty.");
  if (buffer.length > MAX_FILE_BYTES) throw new ApiError(413, `The file is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB. Split it into smaller files.`);
  const zip = buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const ole = buffer.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (!zip && !ole) throw new ApiError(400, "The file is not a valid Excel workbook.");
  return buffer;
}

/** Rows of the first sheet keyed by column id, with their spreadsheet line numbers. */
function parseWorkbook(buffer) {
  let sheet;
  try {
    const book = XLSX.read(buffer, { type: "buffer", cellDates: true });
    sheet = book.Sheets[book.SheetNames[0]];
  } catch {
    throw new ApiError(400, "The workbook could not be read.");
  }
  if (!sheet) throw new ApiError(400, "The workbook has no sheets.");
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true, raw: true });
  let headerIndex = grid.slice(0, HEADER_SCAN).findIndex((cells) => cells.some((c) => ADMISSION_KEYS.has(normKey(c))));
  if (headerIndex < 0) headerIndex = 0;
  const header = (grid[headerIndex] || []).map(normKey);
  const index = {};
  for (const [id, col] of Object.entries(COLUMNS)) {
    const at = header.findIndex((h) => col.keys.includes(h));
    if (at >= 0) index[id] = at;
  }
  const missing = Object.entries(COLUMNS).filter(([id, c]) => c.required && index[id] === undefined).map(([, c]) => c.label);
  if (missing.length) throw new ApiError(400, `The file is missing template columns: ${missing.join(", ")}. Download the template and copy your rows into it.`);
  const rows = [];
  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const cells = grid[i];
    if (!cells.some((c) => text(c) !== "")) continue;
    const row = { line: i + 1 };
    for (const id of Object.keys(COLUMNS)) row[id] = index[id] === undefined ? "" : cells[index[id]];
    rows.push(row);
  }
  if (rows.length > MAX_ROWS) throw new ApiError(400, `The file has ${rows.length} rows; the limit is ${MAX_ROWS}. Split it into smaller files.`);
  return rows;
}

const importKey = (schoolId, reference) => `import:${schoolId}:${reference}`;

/** Every rule for every row; returns the stored row values with status and reasons. */
async function checkRows(actor, rows) {
  const now = today();
  const admissionNos = [...new Set(rows.map((r) => text(r.admissionNo)).filter(Boolean))];
  const students = admissionNos.length ? await Students.findAll({ where: { fkSchoolId: actor.schoolId, admissionNo: admissionNos } }) : [];
  const byAdm = new Map(students.map((s) => [s.admissionNo, s]));
  const classIds = [...new Set(students.map((s) => s.fkClassId).filter(Boolean))];
  const classes = classIds.length ? await Classes.findAll({ where: { id: classIds }, attributes: ["id", "label"] }) : [];
  const classLabel = new Map(classes.map((c) => [c.id, c.label]));
  const bills = students.length
    ? await StudentFeeMonths.findAll({ where: { fkStudentId: students.map((s) => s.id) }, attributes: ["fkStudentId", "month"] })
    : [];
  const billed = new Set(bills.map((b) => `${b.fkStudentId}|${b.month}`));
  const refs = [...new Set(rows.map((r) => text(r.reference)).filter(Boolean))];
  const existing = refs.length
    ? await FeePayments.findAll({
        where: { fkSchoolId: actor.schoolId, [Op.or]: [{ idempotencyKey: refs.map((r) => importKey(actor.schoolId, r)) }, { referenceNo: refs }] },
        attributes: ["id", "receiptNo", "referenceNo", "idempotencyKey"],
      })
    : [];
  const taken = new Map();
  for (const p of existing) {
    if (p.referenceNo) taken.set(p.referenceNo.toLowerCase(), p);
    if (p.idempotencyKey) taken.set(String(p.idempotencyKey).slice(`import:${actor.schoolId}:`.length).toLowerCase(), p);
  }
  const firstLine = new Map();

  return rows.map((row) => {
    const errors = [];
    const admissionNo = text(row.admissionNo);
    const reference = text(row.reference);
    const student = admissionNo ? byAdm.get(admissionNo) : null;
    if (!admissionNo) errors.push("Admission Number (Student ID) is required.");
    else if (!student) errors.push(`Student ID ${admissionNo} not found.`);
    else if (!ENROLLED.includes(student.status)) errors.push(`Student ${admissionNo} is not enrolled (status ${student.status}).`);

    const klass = student ? classLabel.get(student.fkClassId) || "" : "";
    const givenClass = text(row.className);
    if (student && givenClass && squash(givenClass) !== squash(klass)) errors.push(`Class "${givenClass}" does not match the student's class (${klass || "none"}).`);

    const paymentDate = realDay(row.paymentDate);
    if (text(row.paymentDate) === "" && !(row.paymentDate instanceof Date)) errors.push("Payment Date is required.");
    else if (!paymentDate) errors.push("Payment Date must be a real date in YYYY-MM-DD format.");
    else if (paymentDate > now) errors.push(`Payment Date ${paymentDate} is in the future.`);
    else if (paymentDate < "2000-01-01") errors.push(`Payment Date ${paymentDate} is too old.`);

    const monthParts = row.months instanceof Date ? [row.months] : text(row.months).split(/[,;]/).map((m) => m.trim()).filter(Boolean);
    const months = [];
    if (!monthParts.length) errors.push("Month is required (YYYY-MM).");
    for (const part of monthParts) {
      const m = monthOf(part);
      if (!m) {
        errors.push(`Month "${text(part)}" must be in YYYY-MM format (e.g. 2026-09).`);
        continue;
      }
      if (months.includes(m)) continue;
      months.push(m);
      if (m > (paymentDate || now).slice(0, 7)) errors.push(`Month ${m} is after the payment date; future months are not pre-paid (extra money becomes credit).`);
      else if (student && !billed.has(`${student.id}|${m}`)) errors.push(`Month ${m} is not a fee period on this student's ledger.`);
    }

    const amount = amountOf(row.amount);
    if (text(row.amount) === "") errors.push("Amount is required.");
    else if (!Number.isFinite(amount) || amount <= 0) errors.push("Amount must be a positive number.");
    else if (Math.round(amount * 100) !== amount * 100) errors.push("Amount can have at most 2 decimals.");
    else if (amount > MAX_AMOUNT) errors.push(`Amount is above the ${MAX_AMOUNT.toLocaleString("en-US")} limit.`);

    const methodText = text(row.method);
    const method = methodText ? METHODS[normKey(methodText)] : "Cash";
    if (!method) errors.push(`Payment Method must be one of: ${METHOD_LABELS}.`);

    if (!reference) errors.push("Receipt/Reference No. is required.");
    else if (reference.length > 80) errors.push("Receipt/Reference No. is longer than 80 characters.");
    const notes = text(row.notes);
    if (notes.length > 500) errors.push("Notes are longer than 500 characters.");

    let status = errors.length ? "Error" : "Valid";
    // Duplicates are judged among rows that would otherwise import: a failed row never "uses up" its receipt.
    if (reference && !errors.length) {
      const key = reference.toLowerCase();
      const first = firstLine.get(key);
      const prior = taken.get(key);
      if (first !== undefined) {
        status = "Duplicate";
        errors.push(`Receipt ${reference} appears more than once in this file (first on row ${first}).`);
      } else {
        firstLine.set(key, row.line);
        if (prior) {
          status = "Duplicate";
          errors.push(`Receipt ${reference} already exists in the system (${prior.receiptNo}).`);
        }
      }
    }
    return {
      rowNumber: row.line,
      admissionNo: admissionNo.slice(0, 50) || null,
      fkStudentId: student ? student.id : null,
      month: months.join(", ").slice(0, 255) || text(row.months).slice(0, 255) || null,
      amount: Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT ? amount : null,
      paymentDate: paymentDate || null,
      referenceNo: reference.slice(0, 100) || null,
      paymentMethod: method || null,
      status,
      errors,
      raw: {
        admissionNo,
        studentName: text(row.studentName) || (student ? `${student.firstName} ${student.lastName}`.trim() : ""),
        className: givenClass || klass,
        months: row.months instanceof Date ? ymd(row.months).slice(0, 7) : text(row.months),
        amount: typeof row.amount === "number" ? row.amount : text(row.amount),
        paymentDate: row.paymentDate instanceof Date ? ymd(row.paymentDate) : text(row.paymentDate),
        reference,
        method: methodText,
        notes,
      },
    };
  });
}

const SKIPPED = ["Duplicate", "Skipped"];
const counts = (rows) => ({
  total: rows.length,
  valid: rows.filter((r) => r.status === "Valid").length,
  imported: rows.filter((r) => r.status === "Imported").length,
  skipped: rows.filter((r) => SKIPPED.includes(r.status)).length,
  failed: rows.filter((r) => r.status === "Error").length,
});

function presentRow(r) {
  const raw = r.raw || {};
  return {
    rowNumber: r.rowNumber,
    admissionNo: r.admissionNo || raw.admissionNo || "",
    studentName: raw.studentName || "",
    className: raw.className || "",
    month: r.month || raw.months || "",
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
    paymentDate: r.paymentDate || raw.paymentDate || "",
    referenceNo: r.referenceNo || raw.reference || "",
    paymentMethod: r.paymentMethod || raw.method || "",
    status: r.status,
    reasons: r.errors || [],
    receiptNo: r.payment ? r.payment.receiptNo : null,
  };
}

function presentBatch(actor, batch, rows) {
  const c = rows ? counts(rows) : { total: batch.totalRows, valid: batch.validRows, imported: batch.importedRows, skipped: batch.duplicateRows, failed: batch.errorRows };
  const view = {
    id: batch.id,
    fileName: batch.fileName,
    fileHash: batch.fileHash,
    status: batch.status,
    createdAt: batch.created_at || batch.createdAt,
    committedAt: batch.committedAt,
    uploadedBy: batch.uploadedBy ? `${batch.uploadedBy.firstName} ${batch.uploadedBy.lastName}`.trim() : null,
    totalRows: c.total,
    validRows: batch.status === "Validated" ? c.valid : batch.validRows,
    importedRows: c.imported,
    skippedRows: c.skipped,
    failedRows: c.failed,
    hasErrorReport: c.skipped + c.failed > 0,
  };
  // BR-11: money totals are for the super admin only; the accountant gets counts.
  if (seesTotals(actor)) view.validAmount = Number(batch.totalAmount || 0);
  return view;
}

function scope(actor) {
  const where = { fkSchoolId: actor.schoolId };
  if (isAccountant(actor)) where.fkUploadedByUserId = actor.id;
  return where;
}

async function findBatch(actor, id, options = {}) {
  const batch = await FeeImportBatches.findOne({ where: { ...scope(actor), id }, include: [{ model: Users, as: "uploadedBy", attributes: ["firstName", "lastName"] }], ...options });
  if (!batch) throw new ApiError(404, "Import batch not found");
  return batch;
}

async function batchRows(batchId, options = {}) {
  return FeeImportRows.findAll({ where: { fkBatchId: batchId }, include: [{ model: FeePayments, as: "payment", attributes: ["id", "receiptNo"], required: false }], order: [["rowNumber", "ASC"]], ...options });
}

async function detail(actor, id) {
  const batch = await findBatch(actor, id);
  const rows = (await batchRows(batch.id)).map((r) => r.get({ plain: true }));
  return { batch: presentBatch(actor, batch, rows), rows: rows.map(presentRow) };
}

/** Step 4: validate the file. Writes only the batch and its rows (plus one audit entry). */
async function validateFile(actor, { fileName, filename, contentBase64 }) {
  const name = String(fileName || filename || "").trim().slice(0, 255);
  const buffer = checkFile({ fileName: name, contentBase64 });
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const parsed = parseWorkbook(buffer);
  const rows = await checkRows(actor, parsed);
  const c = counts(rows);
  const validAmount = rows.filter((r) => r.status === "Valid").reduce((n, r) => n + Math.round(r.amount * 100), 0) / 100;
  const previous = await FeeImportBatches.findOne({ where: { ...scope(actor), fileHash, status: "Committed" }, order: [["id", "DESC"]], attributes: ["id", "committedAt"] });
  const batchId = await sequelize.transaction(async (transaction) => {
    const batch = await FeeImportBatches.create(
      {
        fkSchoolId: actor.schoolId,
        fileName: name,
        fileHash,
        status: "Validated",
        totalRows: c.total,
        validRows: c.valid,
        errorRows: c.failed,
        duplicateRows: c.skipped,
        importedRows: 0,
        totalAmount: validAmount,
        fkUploadedByUserId: actor.id,
      },
      { transaction },
    );
    if (rows.length) await FeeImportRows.bulkCreate(rows.map((r) => ({ ...r, fkBatchId: batch.id })), { transaction });
    await auditService.record(
      actor,
      `validated fee import ${name}: ${c.valid} valid, ${c.skipped} skipped, ${c.failed} failed`.slice(0, 100),
      { entityType: "fee_import", entityId: batch.id, metadata: { fileName: name, fileHash, totalRows: c.total, valid: c.valid, skipped: c.skipped, failed: c.failed } },
      { transaction },
    );
    return batch.id;
  });
  const result = await detail(actor, batchId);
  result.previousImport = previous ? { batchId: previous.id, committedAt: previous.committedAt } : null;
  return result;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9:._-]{8,120}$/;

/** Step 6: import the Valid rows, one transaction per row, at most once per Idempotency-Key. */
async function commit(actor, id, idempotencyKey) {
  const key = String(idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY.test(key)) throw new ApiError(400, "An Idempotency-Key header (8-120 characters) is required to import.");
  const batch = await findBatch(actor, id);
  if (batch.status === "Committed") {
    if (batch.commitKey === key) return { ...(await detail(actor, batch.id)), replayed: true };
    throw new ApiError(409, "This file was already imported.");
  }
  if (batch.status === "Committing" && batch.commitKey !== key) throw new ApiError(409, "This import is already in progress.");
  if (!["Validated", "Committing"].includes(batch.status)) throw new ApiError(409, `This batch is ${batch.status.toLowerCase()} and cannot be imported.`);

  if (batch.status === "Validated") {
    let claimed;
    try {
      [, claimed] = await sequelize.query(
        `UPDATE fee_import_batches SET status = 'Committing', commit_key = :key, updated_at = NOW() WHERE id = :id AND status = 'Validated'`,
        { replacements: { key, id: batch.id }, type: QueryTypes.UPDATE },
      );
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") throw new ApiError(409, "This Idempotency-Key was already used for another import.");
      throw error;
    }
    if (!claimed) {
      const now = await FeeImportBatches.findByPk(batch.id);
      if (now.commitKey !== key) throw new ApiError(409, "This import is already in progress.");
      if (now.status === "Committed") return { ...(await detail(actor, batch.id)), replayed: true };
    }
  }

  const pending = await FeeImportRows.findAll({ where: { fkBatchId: batch.id, status: "Valid" }, order: [["rowNumber", "ASC"]] });
  for (const pendingRow of pending) {
    try {
      await sequelize.transaction(async (transaction) => {
        const row = await FeeImportRows.findByPk(pendingRow.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (row.status !== "Valid") return;
        const student = await Students.findOne({ where: { id: row.fkStudentId, fkSchoolId: actor.schoolId }, transaction });
        if (!student || !ENROLLED.includes(student.status)) {
          await row.update({ status: "Error", errors: [`Student ${row.admissionNo} is no longer enrolled.`] }, { transaction });
          return;
        }
        const notes = [row.raw?.notes, `Offline import: ${batch.fileName} row ${row.rowNumber}`].filter(Boolean).join(" | ").slice(0, 500);
        const recorded = await feeService.recordPayment(
          actor,
          {
            studentId: student.id,
            amount: Number(row.amount),
            paidOn: row.paymentDate,
            method: row.paymentMethod || "Cash",
            notes,
            referenceNo: row.referenceNo,
            idempotencyKey: importKey(actor.schoolId, row.referenceNo),
          },
          { transaction },
        );
        if (recorded.duplicate) {
          await row.update({ status: "Skipped", errors: [`Receipt ${row.referenceNo} already exists in the system (${recorded.receipt.receiptNo}).`] }, { transaction });
          return;
        }
        const receipt = recorded.receipt;
        await row.update({ status: "Imported", errors: [], fkPaymentId: receipt.id }, { transaction });
        await auditService.record(
          actor,
          `imported offline receipt ${row.referenceNo} as ${receipt.receiptNo}`.slice(0, 100),
          {
            entityType: "fee_import",
            entityId: batch.id,
            metadata: {
              batchId: batch.id,
              rowNumber: row.rowNumber,
              fileHash: batch.fileHash,
              studentId: student.id,
              paymentId: receipt.id,
              receiptNo: receipt.receiptNo,
              referenceNo: row.referenceNo,
              amount: Number(row.amount),
              months: receipt.feeMonths.map((m) => m.month),
              creditAdded: receipt.creditAdded,
            },
          },
          { transaction },
        );
      });
    } catch (error) {
      await FeeImportRows.update({ status: "Error", errors: [`Not imported: ${error.message || "unexpected error"}`.slice(0, 300)] }, { where: { id: pendingRow.id, status: "Valid" } });
    }
  }

  const rows = (await batchRows(batch.id)).map((r) => r.get({ plain: true }));
  const c = counts(rows);
  await sequelize.transaction(async (transaction) => {
    await FeeImportBatches.update(
      { status: "Committed", committedAt: new Date(), importedRows: c.imported, duplicateRows: c.skipped, errorRows: c.failed },
      { where: { id: batch.id }, transaction },
    );
    await auditService.record(
      actor,
      `committed fee import ${batch.fileName}: ${c.imported} imported, ${c.skipped} skipped, ${c.failed} failed`.slice(0, 100),
      { entityType: "fee_import", entityId: batch.id, metadata: { fileName: batch.fileName, fileHash: batch.fileHash, idempotencyKey: key, imported: c.imported, skipped: c.skipped, failed: c.failed } },
      { transaction },
    );
  });
  return { ...(await detail(actor, batch.id)), replayed: false };
}

/** "Start over": a validated batch that will not be imported. */
async function discard(actor, id) {
  const batch = await findBatch(actor, id);
  if (batch.status !== "Validated") throw new ApiError(409, "Only a validated, not yet imported file can be discarded.");
  await sequelize.transaction(async (transaction) => {
    await batch.update({ status: "Discarded" }, { transaction });
    await auditService.record(actor, `discarded fee import ${batch.fileName}`.slice(0, 100), { entityType: "fee_import", entityId: batch.id, metadata: { fileHash: batch.fileHash } }, { transaction });
  });
  return detail(actor, batch.id);
}

/** Sync history, newest first. Discarded validations are hidden. */
async function history(actor, { limit = 50 } = {}) {
  const batches = await FeeImportBatches.findAll({
    where: { ...scope(actor), status: { [Op.ne]: "Discarded" } },
    include: [{ model: Users, as: "uploadedBy", attributes: ["firstName", "lastName"] }],
    order: [["id", "DESC"]],
    limit: Math.min(Number(limit) || 50, 200),
  });
  return batches.map((b) => presentBatch(actor, b));
}

const REPORT_COLUMNS = [
  ["Row", 7], ["Admission Number", 18], ["Student Name", 22], ["Class", 14], ["Month(s)", 16], ["Amount", 12],
  ["Payment Date", 14], ["Receipt/Reference No.", 22], ["Payment Method", 15], ["Notes", 24], ["Status", 12], ["Reason", 60],
];

/** Skipped + failed rows with the reason for each, as a branded xlsx. Cells are formula-safe. */
async function errorReport(actor, id, brand) {
  const batch = await findBatch(actor, id);
  const rows = (await batchRows(batch.id)).map((r) => r.get({ plain: true })).filter((r) => ["Error", ...SKIPPED].includes(r.status));
  const book = new ExcelJS.Workbook();
  book.creator = brand.name;
  const sheet = book.addWorksheet("Errors");
  sheet.columns = REPORT_COLUMNS.map(([, width]) => ({ width }));
  const c = counts(rows);
  const head = xlsxHeader(book, sheet, brand, {
    title: "Offline sync - error report",
    facts: [["File", safeCell(batch.fileName)], ["Uploaded", `${new Date(batch.created_at || batch.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" })} PKT`], ["Skipped", c.skipped], ["Failed", c.failed]],
    span: REPORT_COLUMNS.length,
  });
  const headRow = sheet.getRow(head);
  headRow.values = REPORT_COLUMNS.map(([label]) => label);
  xlsxHeadRow(headRow, brand);
  rows.forEach((r, i) => {
    const raw = r.raw || {};
    const values = [
      r.rowNumber, raw.admissionNo ?? r.admissionNo, raw.studentName, raw.className, raw.months ?? r.month,
      typeof raw.amount === "number" ? raw.amount : raw.amount, raw.paymentDate, raw.reference ?? r.referenceNo, raw.method, raw.notes,
      SKIPPED.includes(r.status) ? "Skipped" : "Failed", (r.errors || []).join(" "),
    ].map((v) => safeCell(v === undefined || v === null ? "" : v));
    const row = sheet.getRow(head + 1 + i);
    row.values = values;
    row.getCell(12).alignment = { wrapText: true, vertical: "top" };
  });
  sheet.views = [{ state: "frozen", ySplit: head }];
  await auditService.record(actor, `downloaded fee import error report #${batch.id}`.slice(0, 100), { entityType: "fee_import", entityId: batch.id, metadata: { rows: rows.length } });
  return { buffer: Buffer.from(await book.xlsx.writeBuffer()), filename: `offline-sync-errors-${batch.id}` };
}

module.exports = { validateFile, commit, discard, history, detail, errorReport, safeCell, TEMPLATE_COLUMNS, COLUMNS, MAX_FILE_BYTES, MAX_ROWS };
