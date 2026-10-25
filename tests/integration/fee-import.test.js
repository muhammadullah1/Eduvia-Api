"use strict";

/**
 * Finance Step 7: offline sync (Excel fee import). Validation checks every rule and
 * writes only the batch; commit goes through the counter allocator one transaction per
 * row (oldest bill first, excess -> credit, never future months), at most once per
 * Idempotency-Key; re-uploads and concurrent commits never double-pay; the error report
 * is formula-safe; everything is audited; role access and the accountant's counts-only view.
 */
const crypto = require("crypto");
const XLSX = require("xlsx");
const app = require("../../app");
const { sequelize } = require("../../models");
const feeService = require("../../services/fee.service");
const { today } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const HEADER = ["Admission Number", "Student Name", "Class", "Month(s)", "Amount", "Payment Date", "Receipt/Reference No.", "Payment Method", "Notes"];
const PAID_ON = "2026-09-15";
const q = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const one = async (sql, r) => (await q(sql, r))[0];
const call = (token, method, path, body, headers) => request(app, { method, path: `/api${path}`, token, body, headers });
const book = (rows, bookType = "xlsx") => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), "Payments");
  return XLSX.write(wb, { type: "base64", bookType });
};
const key = () => `test-${crypto.randomBytes(8).toString("hex")}`;
const uid = () => crypto.randomBytes(4).toString("hex").toUpperCase();

let school; let admin; let acc; let tok; let klass; let s1; let s2; let s3; let gone;
const counts = async () => one(
  `SELECT (SELECT COUNT(*)::int FROM fee_payments WHERE fk_school_id = :s) AS payments,
          (SELECT COUNT(*)::int FROM fee_allocations a JOIN fee_payments p ON p.id = a.fk_payment_id WHERE p.fk_school_id = :s) AS allocations,
          (SELECT COUNT(*)::int FROM student_credit_ledger WHERE fk_school_id = :s) AS credits,
          (SELECT COUNT(*)::int FROM student_fee_months WHERE fk_school_id = :s) AS bills,
          (SELECT COALESCE(SUM(paid_amount), 0)::float FROM student_fee_months WHERE fk_school_id = :s) AS paid`,
  { s: school.id },
);
const validate = (token, fileName, contentBase64) => call(token, "POST", "/fees/imports/validate", { fileName, contentBase64 });
const commit = (token, id, k = key()) => call(token, "POST", `/fees/imports/${id}/commit`, undefined, k === null ? {} : { "Idempotency-Key": k });

beforeAll(async () => {
  await sequelize.authenticate();
  ({ school } = await makeSchool());
  const session = await one("SELECT id FROM academic_sessions WHERE fk_school_id = :s", { s: school.id });
  admin = await makeUser(school.id, "super_admin");
  acc = await makeUser(school.id, "accountant");
  klass = await makeClass(school.id, session.id, "Imp 1");
  s1 = await makeStudent(school.id, klass.id, { firstName: "Aisha" });
  s2 = await makeStudent(school.id, klass.id, { firstName: "Bilal" });
  s3 = await makeStudent(school.id, klass.id, { firstName: "Fatima" });
  gone = await makeStudent(school.id, klass.id, { firstName: "Gone", status: "Withdrawn" });
  const users = { admin, acc, ops: await makeUser(school.id, "operations_manager"), teacher: await makeUser(school.id, "teacher") };
  users.parent = await makeParent(school.id, s1.id);
  tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
  expect((await call(tok.admin, "POST", "/fees/months/generate", { month: "2026-09" })).status).toBe(201);
  // A counter payment with a paper reference: importing that reference again is a duplicate.
  await feeService.recordPayment({ id: admin.id, schoolId: school.id, role: "super_admin", email: admin.email }, { studentId: s3.id, amount: 1000, paidOn: "2026-09-01", referenceNo: "TRF-9901" });
});
afterAll(() => sequelize.close());

test("fixture: every enrolled student has Apr-Sep bills of 1,000", async () => {
  const row = await one("SELECT COUNT(*)::int AS n, COUNT(DISTINCT month)::int AS months, MAX(month) AS last FROM student_fee_months WHERE fk_student_id = :id", { id: s1.id });
  expect(row).toEqual({ n: 6, months: 6, last: "2026-09" });
});

describe("validation", () => {
  test("every rule is checked, duplicates in the file and in the system are skipped, nothing but the batch is written", async () => {
    const ref = uid();
    const rows = [
      [s1.admissionNo, "Aisha", "Imp 1", "2026-09", 1500, PAID_ON, `CASH-${ref}-1`, "Cash", ""], // 2 valid
      ["CLS-9999-XXX", "", "", "2026-09", 3600, PAID_ON, `CASH-${ref}-2`, "Cash", ""], // 3 unknown
      [gone.admissionNo, "", "", "2026-09", 100, PAID_ON, `CASH-${ref}-3`, "Cash", ""], // 4 not enrolled
      [s2.admissionNo, "", "Grade 9", "2026-09", 100, PAID_ON, `CASH-${ref}-4`, "Cash", ""], // 5 class mismatch
      [s2.admissionNo, "", "", "Sep 2026", 100, PAID_ON, `CASH-${ref}-5`, "Cash", ""], // 6 month format
      [s2.admissionNo, "", "", "2026-12", 100, PAID_ON, `CASH-${ref}-6`, "Cash", ""], // 7 future month
      [s2.admissionNo, "", "", "2025-01", 100, PAID_ON, `CASH-${ref}-7`, "Cash", ""], // 8 not on ledger
      [s2.admissionNo, "", "", "2026-09", 0, PAID_ON, `CASH-${ref}-8`, "Cash", ""], // 9 zero
      [s2.admissionNo, "", "", "2026-09", -50, PAID_ON, `CASH-${ref}-9`, "Cash", ""], // 10 negative
      [s2.admissionNo, "", "", "2026-09", "abc", PAID_ON, `CASH-${ref}-10`, "Cash", ""], // 11 text
      [s2.admissionNo, "", "", "2026-09", "", PAID_ON, `CASH-${ref}-11`, "Cash", ""], // 12 blank
      [s2.admissionNo, "", "", "2026-09", 100, "2099-01-01", `CASH-${ref}-12`, "Cash", ""], // 13 future date
      [s2.admissionNo, "", "", "2026-09", 100, "2026-02-30", `CASH-${ref}-13`, "Cash", ""], // 14 impossible date
      [s2.admissionNo, "", "", "2026-09", 100, PAID_ON, "", "Cash", ""], // 15 missing ref
      [s2.admissionNo, "", "", "2026-09", 100, PAID_ON, `CASH-${ref}-15`, "Crypto", ""], // 16 method
      [s2.admissionNo, "", "", "2026-09", 100, PAID_ON, `cash-${ref}-1`, "Cash", ""], // 17 in-file duplicate (case-insensitive)
      [s3.admissionNo, "", "", "2026-08", 3600, PAID_ON, "TRF-9901", "Bank Transfer", ""], // 18 already in the system
      [s2.admissionNo, "", "IMP-1", "2026-08, 2026-09", "2,000", PAID_ON, `CHQ-${ref}`, "cheque", "two months"], // 19 valid
      [],
    ];
    const before = await counts();
    const contentBase64 = book(rows);
    const res = await validate(tok.admin, "rules.xlsx", contentBase64);
    expect(res.status).toBe(201);
    const { batch, rows: out } = res.body.data;
    const byRow = Object.fromEntries(out.map((r) => [r.rowNumber, r]));
    expect(batch).toMatchObject({ status: "Validated", totalRows: 18, validRows: 2, skippedRows: 2, failedRows: 14, validAmount: 3500 });
    expect(batch.fileHash).toBe(crypto.createHash("sha256").update(Buffer.from(contentBase64, "base64")).digest("hex"));
    const expectReason = (row, status, text) => {
      expect(byRow[row].status).toBe(status);
      expect(byRow[row].reasons.join(" ")).toMatch(text);
    };
    expect(byRow[2]).toMatchObject({ status: "Valid", reasons: [], studentName: "Aisha", className: "Imp 1" });
    expectReason(3, "Error", /Student ID CLS-9999-XXX not found/);
    expectReason(4, "Error", /not enrolled \(status Withdrawn\)/);
    expectReason(5, "Error", /does not match the student's class/);
    expectReason(6, "Error", /YYYY-MM format/);
    expectReason(7, "Error", /after the payment date/);
    expectReason(8, "Error", /not a fee period/);
    for (const r of [9, 10, 11]) expectReason(r, "Error", /positive number/);
    expectReason(12, "Error", /Amount is required/);
    expectReason(13, "Error", /in the future/);
    expectReason(14, "Error", /real date/);
    expectReason(15, "Error", /Receipt\/Reference No. is required/);
    expectReason(16, "Error", /Payment Method must be one of/);
    expectReason(17, "Duplicate", /more than once in this file \(first on row 2\)/);
    expectReason(18, "Duplicate", /TRF-9901 already exists in the system/);
    expect(byRow[19]).toMatchObject({ status: "Valid", month: "2026-08, 2026-09", amount: 2000, paymentMethod: "Cheque" });
    // Validation wrote nothing but the batch.
    expect(await counts()).toEqual(before);
    const stored = await one("SELECT status, file_hash, total_rows, valid_rows, error_rows, duplicate_rows FROM fee_import_batches WHERE id = :id", { id: batch.id });
    expect(stored).toMatchObject({ status: "Validated", file_hash: batch.fileHash, total_rows: 18, valid_rows: 2, error_rows: 14, duplicate_rows: 2 });
    expect((await one("SELECT COUNT(*)::int AS n FROM fee_import_rows WHERE fk_batch_id = :id", { id: batch.id })).n).toBe(18);
  });

  test("file checks: extension, content, size, row count, template columns; .xls is accepted", async () => {
    const good = book([[s1.admissionNo, "", "", "2026-09", 10, PAID_ON, `XLS-${uid()}`, "Cash", ""]]);
    expect((await validate(tok.admin, "data.csv", good)).status).toBe(400);
    expect((await validate(tok.admin, "fake.xlsx", Buffer.from("not,an,excel\n1,2,3").toString("base64"))).body.message).toMatch(/not a valid Excel/);
    expect((await validate(tok.admin, "big.xlsx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(720 * 1024)]).toString("base64"))).status).toBe(413);
    const many = Array.from({ length: 1001 }, (_, i) => [s1.admissionNo, "", "", "2026-09", 1, PAID_ON, `M-${i}`, "Cash", ""]);
    expect((await validate(tok.admin, "many.xlsx", book(many))).body.message).toMatch(/limit is 1000/);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Admission Number", "Amount"], [s1.admissionNo, 5]]), "S");
    expect((await validate(tok.admin, "cols.xlsx", XLSX.write(wb, { type: "base64", bookType: "xlsx" }))).body.message).toMatch(/missing template columns: Month\(s\), Payment Date, Receipt\/Reference No\./);
    const xls = await validate(tok.admin, "old.xls", book([[s1.admissionNo, "", "", "2026-09", 10, PAID_ON, `XLS-${uid()}`, "Cash", ""]], "biff8"));
    expect(xls.status).toBe(201);
    expect(xls.body.data.batch.validRows).toBe(1);
  });
});

describe("commit", () => {
  test("preview vs commit: allocator oldest first, excess becomes credit (no future months), audited, Idempotency-Key replay", async () => {
    const ref = uid();
    const fresh = await makeStudent(school.id, klass.id, { firstName: "Over" });
    await call(tok.admin, "POST", "/fees/months/generate", { month: "2026-09" });
    const rows = [
      [fresh.admissionNo, "", "", "2026-04", 7500, PAID_ON, `OVR-${ref}`, "Cash", "overpaid"], // owes 6,000 -> 1,500 credit
      [s1.admissionNo, "", "", "2026-04", 1000, PAID_ON, `ONE-${ref}`, "Online", ""],
      ["NOPE", "", "", "2026-09", 1, PAID_ON, `BAD-${ref}`, "Cash", ""],
    ];
    const v = (await validate(tok.admin, "commit.xlsx", book(rows))).body.data;
    expect(v.batch).toMatchObject({ validRows: 2, failedRows: 1 });
    const before = await counts();
    expect((await commit(tok.admin, v.batch.id, null)).status).toBe(400); // header required
    expect(await counts()).toEqual(before);

    const k = key();
    const res = await commit(tok.admin, v.batch.id, k);
    expect(res.status).toBe(200);
    expect(res.body.data.batch).toMatchObject({ status: "Committed", importedRows: 2, skippedRows: 0, failedRows: 1 });
    const after = await counts();
    expect(after.payments - before.payments).toBe(2);

    const pay = await one("SELECT id, amount_paid::float AS amount, unallocated_amount::float AS unalloc, idempotency_key, reference_no, payment_method FROM fee_payments WHERE reference_no = :r", { r: `OVR-${ref}` });
    expect(pay).toMatchObject({ amount: 7500, unalloc: 1500, idempotency_key: `import:${school.id}:OVR-${ref}`, payment_method: "Cash" });
    const alloc = await q("SELECT m.month, a.allocated_amount::float AS amt FROM fee_allocations a JOIN student_fee_months m ON m.id = a.fk_fee_month_id WHERE a.fk_payment_id = :p ORDER BY m.month", { p: pay.id });
    expect(alloc.map((a) => a.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(alloc.reduce((n, a) => n + a.amt, 0)).toBe(6000);
    expect((await one("SELECT COUNT(*)::int AS n FROM student_fee_months WHERE fk_student_id = :id AND month > '2026-09'", { id: fresh.id })).n).toBe(0);
    const credit = await q("SELECT entry_type, amount::float AS amount, fk_payment_id FROM student_credit_ledger WHERE fk_student_id = :id", { id: fresh.id });
    expect(credit).toEqual([{ entry_type: "Credit", amount: 1500, fk_payment_id: pay.id }]);

    const rowsDb = await q("SELECT row_number, status, fk_payment_id FROM fee_import_rows WHERE fk_batch_id = :b ORDER BY row_number", { b: v.batch.id });
    expect(rowsDb.map((r) => r.status)).toEqual(["Imported", "Imported", "Error"]);
    expect(rowsDb[0].fk_payment_id).toBe(pay.id);
    const audits = await q("SELECT action, metadata FROM audit_logs WHERE fk_school_id = :s AND entity_type = 'fee_import' AND entity_id = :b ORDER BY id", { s: school.id, b: String(v.batch.id) });
    expect(audits.map((a) => a.action.split(" ").slice(0, 2).join(" "))).toEqual(["validated fee", "imported offline", "imported offline", "committed fee"]);
    expect(audits[1].metadata).toMatchObject({ batchId: v.batch.id, rowNumber: 2, paymentId: pay.id, referenceNo: `OVR-${ref}`, creditAdded: 1500 });
    expect(audits[3].metadata).toMatchObject({ idempotencyKey: k, imported: 2, failed: 1 });

    const replay = await commit(tok.admin, v.batch.id, k);
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect((await commit(tok.admin, v.batch.id, key())).status).toBe(409);
    expect(await counts()).toEqual(after);
  });

  test("re-uploading the same file gives only skipped rows and never a second payment", async () => {
    const ref = uid();
    const content = book([[s2.admissionNo, "", "", "2026-04", 500, PAID_ON, `RE-${ref}-1`, "Cash", ""], [s2.admissionNo, "", "", "2026-04", 700, PAID_ON, `RE-${ref}-2`, "Cash", ""]]);
    const first = (await validate(tok.admin, "same.xlsx", content)).body.data;
    await commit(tok.admin, first.batch.id);
    const before = await counts();
    const again = (await validate(tok.admin, "same.xlsx", content)).body.data;
    expect(again.batch).toMatchObject({ validRows: 0, skippedRows: 2, failedRows: 0, fileHash: first.batch.fileHash });
    expect(again.previousImport).toMatchObject({ batchId: first.batch.id });
    expect(again.rows.every((r) => r.status === "Duplicate" && /already exists in the system/.test(r.reasons[0]))).toBe(true);
    const c = (await commit(tok.admin, again.batch.id)).body.data.batch;
    expect(c).toMatchObject({ importedRows: 0, skippedRows: 2 });
    expect(await counts()).toEqual(before);
  });

  test("concurrent commits: same batch with one key, other keys, and two validated copies of one file", async () => {
    const ref = uid();
    const content = book([[s1.admissionNo, "", "", "2026-04", 300, PAID_ON, `CC-${ref}-1`, "Cash", ""], [s2.admissionNo, "", "", "2026-04", 400, PAID_ON, `CC-${ref}-2`, "Cash", ""]]);
    const a = (await validate(tok.admin, "a.xlsx", content)).body.data.batch;
    const b = (await validate(tok.admin, "b.xlsx", content)).body.data.batch; // validated before either commits: both rows Valid
    expect(b.validRows).toBe(2);
    const k = key();
    const results = await Promise.all([commit(tok.admin, a.id, k), commit(tok.admin, a.id, k), commit(tok.admin, a.id, key()), commit(tok.admin, b.id), commit(tok.acc, b.id)]);
    expect(results.slice(0, 2).every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(results.some((r) => r.status === 200)).toBe(true);
    const pays = await q("SELECT reference_no, COUNT(*)::int AS n FROM fee_payments WHERE reference_no IN (:refs) GROUP BY 1 ORDER BY 1", { refs: [`CC-${ref}-1`, `CC-${ref}-2`] });
    expect(pays).toEqual([{ reference_no: `CC-${ref}-1`, n: 1 }, { reference_no: `CC-${ref}-2`, n: 1 }]);
    const status = await q("SELECT fk_batch_id, status FROM fee_import_rows WHERE fk_batch_id IN (:ids) ORDER BY fk_batch_id, row_number", { ids: [a.id, b.id] });
    expect(status.filter((r) => r.status === "Imported")).toHaveLength(2);
    expect(status.filter((r) => r.status === "Skipped")).toHaveLength(2);
    const batches = await q("SELECT status FROM fee_import_batches WHERE id IN (:ids)", { ids: [a.id, b.id] });
    expect(batches.every((x) => x.status === "Committed")).toBe(true);
  });
});

describe("error report, history and access", () => {
  let batchId;
  beforeAll(async () => {
    const ref = uid();
    const content = book([
      [s1.admissionNo, "", "", "2026-04", 100, PAID_ON, `ER-${ref}`, "Cash", ""],
      ["=HYPERLINK(\"http://evil\",\"x\")", "+SUM(1,2)", "@cmd", "2026-09", "-2+3", PAID_ON, `=1+1`, "Cash", "-danger"],
      [s1.admissionNo, "", "", "2026-04", 100, PAID_ON, `er-${ref}`, "Cash", ""],
    ]);
    batchId = (await validate(tok.acc, "=evil.xlsx", content)).body.data.batch.id;
    await commit(tok.acc, batchId);
  });

  test("error report: skipped + failed rows with reasons, formula injection neutralised", async () => {
    const res = await requestRaw(app, { path: `/api/fees/imports/${batchId}/error-report`, token: tok.acc });
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(`offline-sync-errors-${batchId}.xlsx`);
    const wb = XLSX.read(res.body, { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json(wb.Sheets.Errors, { header: 1, blankrows: false });
    const head = grid.findIndex((r) => r[0] === "Row");
    expect(grid[head]).toEqual(["Row", ...HEADER, "Status", "Reason"]);
    const body = grid.slice(head + 1);
    expect(body.map((r) => [r[0], r[10]])).toEqual([[3, "Failed"], [4, "Skipped"]]);
    const evil = body[0];
    for (const cell of [evil[1], evil[2], evil[3], evil[5], evil[7], evil[9]]) expect(String(cell).startsWith("'")).toBe(true);
    expect(evil[11]).toMatch(/not found/);
    expect(body[1][11]).toMatch(/more than once in this file/);
    const sheet = wb.Sheets.Errors;
    expect(Object.values(sheet).some((c) => c && typeof c === "object" && c.f)).toBe(false); // no formulas at all
    expect(JSON.stringify(grid.slice(0, head))).toContain("'=evil.xlsx");
    const audit = await one("SELECT COUNT(*)::int AS n FROM audit_logs WHERE entity_type = 'fee_import' AND entity_id = :b AND action LIKE 'downloaded%'", { b: String(batchId) });
    expect(audit.n).toBe(1);
  });

  test("history: accountant sees own batches with counts only; super admin sees all with amounts", async () => {
    const mine = (await call(tok.acc, "GET", "/fees/imports")).body.data;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.uploadedBy === `Test accountant`)).toBe(true);
    for (const b of mine) {
      expect(b).not.toHaveProperty("validAmount");
      expect(Object.keys(b)).toEqual(expect.arrayContaining(["createdAt", "fileName", "importedRows", "skippedRows", "failedRows", "hasErrorReport"]));
    }
    const detail = (await call(tok.acc, "GET", `/fees/imports/${batchId}`)).body.data;
    expect(detail.batch).not.toHaveProperty("validAmount");
    expect(JSON.stringify(detail)).not.toMatch(/validAmount|totalAmount|"amount_total"/i);
    const all = (await call(tok.admin, "GET", "/fees/imports")).body.data;
    expect(all.length).toBeGreaterThan(mine.length);
    expect(all[0]).toHaveProperty("validAmount");
    const adminBatch = all.find((b) => b.uploadedBy === "Test super_admin");
    expect((await call(tok.acc, "GET", `/fees/imports/${adminBatch.id}`)).status).toBe(404);
    expect((await call(tok.admin, "GET", `/fees/imports/${batchId}`)).status).toBe(200);
  });

  test("discard: start over marks a validated batch discarded and hides it from history", async () => {
    const v = (await validate(tok.admin, "drop.xlsx", book([[s1.admissionNo, "", "", "2026-04", 5, PAID_ON, `DR-${uid()}`, "Cash", ""]]))).body.data.batch;
    expect((await call(tok.admin, "POST", `/fees/imports/${v.id}/discard`)).body.data.batch.status).toBe("Discarded");
    expect((await commit(tok.admin, v.id)).status).toBe(409);
    expect((await call(tok.admin, "GET", "/fees/imports")).body.data.some((b) => b.id === v.id)).toBe(false);
  });

  test("the retired one-shot import endpoint is gone", async () => {
    const content = book([[s1.admissionNo, "", "", "2026-04", 5, PAID_ON, `GONE-${uid()}`, "Cash", ""]]);
    const res = await call(tok.admin, "POST", "/fees/payments/import", { filename: "x.xlsx", contentBase64: content });
    expect([404, 405]).toContain(res.status);
  });

  test("ops, teacher and parent get 403 on every offline-sync endpoint", async () => {
    const content = book([[s1.admissionNo, "", "", "2026-04", 5, PAID_ON, `NO-${uid()}`, "Cash", ""]]);
    for (const who of ["ops", "teacher", "parent"]) {
      const calls = [
        call(tok[who], "GET", "/fees/imports"),
        validate(tok[who], "x.xlsx", content),
        call(tok[who], "GET", `/fees/imports/${batchId}`),
        commit(tok[who], batchId),
        call(tok[who], "POST", `/fees/imports/${batchId}/discard`),
        requestRaw(app, { path: `/api/fees/imports/${batchId}/error-report`, token: tok[who] }),
        requestRaw(app, { path: "/api/fees/import-template", token: tok[who] }),
      ];
      expect((await Promise.all(calls)).map((r) => r.status)).toEqual(Array(7).fill(403));
    }
  });
});

describe("regression", () => {
  test("counter payment path is unchanged: oldest first, overpayment to credit, idempotent", async () => {
    const kid = await makeStudent(school.id, klass.id, { firstName: "Counter" });
    await call(tok.admin, "POST", "/fees/months/generate", { month: "2026-09" });
    const body = { studentId: kid.id, amount: 6200, paidOn: today() > "2026-09-30" ? "2026-09-20" : today(), method: "Cash", idempotencyKey: `counter-${uid()}` };
    const first = await call(tok.acc, "POST", "/fees/payments", body);
    expect(first.status).toBe(201);
    expect(first.body.data.receipt).toMatchObject({ creditAdded: 200 });
    const again = await call(tok.acc, "POST", "/fees/payments", body);
    expect(again.body.data.duplicate).toBe(true);
    expect((await one("SELECT COUNT(*)::int AS n FROM student_fee_months WHERE fk_student_id = :id AND month > '2026-09'", { id: kid.id })).n).toBe(0);
  });

  test("the template has the Figma columns, is branded, and a filled copy validates", async () => {
    const res = await requestRaw(app, { path: "/api/fees/import-template", token: tok.acc });
    const wb = XLSX.read(res.body, { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json(wb.Sheets.Payments, { header: 1, blankrows: true });
    const h = grid.findIndex((r) => r[0] === "Admission Number");
    expect(grid[h]).toEqual(HEADER);
    XLSX.utils.sheet_add_aoa(wb.Sheets.Payments, [[s1.admissionNo, "Aisha", "Imp 1", "2026-09", 50, PAID_ON, `TPL-${uid()}`, "Bank Transfer", ""]], { origin: `A${h + 2}` });
    const v = await validate(tok.acc, "template.xlsx", XLSX.write(wb, { type: "base64", bookType: "xlsx" }));
    expect(v.body.data.rows).toEqual([expect.objectContaining({ rowNumber: h + 2, status: "Valid", paymentMethod: "BankTransfer" })]);
  });
});
