"use strict";

const crypto = require("crypto");
const { Op, fn, col } = require("sequelize");
const {
  FeePayments,
  FeeAllocations,
  StudentFeeMonths,
  StudentStatusEvents,
  StudentCreditLedger,
  Students,
  Classes,
  Users,
  AcademicSessions,
  sequelize,
} = require("../models");
const { USER_ROLES, PAYMENT_STATUS, FEE_MONTH_STATUS, ALLOCATION_MODE, SETTING_KEYS, STUDENT_STATUS } = require("../constants");
const { can } = require("../constants/permissions");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const feeStructureService = require("./fee_structure.service");
const creditLedgerService = require("./credit_ledger.service");
const { today, firstOfMonth, addMonths } = require("../utils/dates");
const { feeMonthStatus, planOldestFirst, validateManualPlan, outstanding, cents, fromCents } = require("../utils/fee_allocation");

/**
 * Monthly fee ledger + payments (UR-08/09, BR-11/12).
 *
 * Every payment is allocated inside one transaction that holds a per-student
 * advisory lock and row locks on the open months, so the oldest unpaid month
 * is always cleared first and two receipts can never race past it.
 */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (month) => `${MONTH_NAMES[Number(String(month).slice(5, 7)) - 1]} ${String(month).slice(0, 4)}`;

/** Fee months are stored as YYYY-MM. The column is seven characters. */
function monthStamp(value) {
  return String(value).slice(0, 7);
}

function stepMonth(stamp, count = 1) {
  return monthStamp(addMonths(`${monthStamp(stamp)}-01`, count));
}

const studentAttributes = ["id", "firstName", "lastName", "admissionNo", "fkClassId"];

function collectibleOf(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  if (plain.collectibleAmount != null && plain.collectibleAmount !== "") return Number(plain.collectibleAmount);
  if (row.getDataValue) {
    const c = row.getDataValue("collectibleAmount");
    if (c != null && c !== "") return Number(c);
    return Number(row.getDataValue("netAmount"));
  }
  return Number(plain.netAmount ?? plain.amountDue ?? 0);
}

function presentMonth(row, currentMonth = monthStamp(today())) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const amountDue = collectibleOf(row);
  const amountPaid = Number(plain.paidAmount ?? plain.amountPaid ?? 0);
  const view = { ...plain, amountDue, amountPaid };
  return {
    id: plain.id,
    month: plain.month,
    label: monthLabel(plain.month),
    feeType: plain.feeType,
    amountDue,
    amountPaid,
    originalNet: Number(plain.netAmount ?? amountDue),
    adjustmentTotal: Number(plain.adjustmentTotal ?? 0),
    discountAmount: Number(plain.discountAmount ?? 0),
    balance: outstanding(view),
    status: feeMonthStatus(view, currentMonth),
    dueDate: plain.dueDate,
  };
}

/**
 * Tuition base billed to `student` for `month` (YYYY-MM), before concessions:
 * 1. fixed_monthly_fee only while concessionsEnabled is false (legacy);
 * 2. class fee structure in force on the 1st of the month;
 * 3. class fee column;
 * 4. school default.
 * discount_percent is never applied.
 */
async function monthlyFeeFor(schoolId, student, transaction, month = today()) {
  const feesSettings = await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction });
  if (!feesSettings.concessionsEnabled && Number(student.fixedMonthlyFee) > 0) {
    return Number(student.fixedMonthlyFee);
  }
  if (student.fkClassId) {
    const structured = await feeStructureService.tuitionForMonth(student.fkClassId, month, { transaction });
    // A 0 row (backfilled from a class with no fee) means "use the school default", as before.
    if (structured !== null && structured > 0) return structured;
  }
  const klass = student.fkClassId ? await Classes.findByPk(student.fkClassId, { transaction }) : null;
  if (klass && Number(klass.monthlyFee) > 0) return Number(klass.monthlyFee);
  return feesSettings.defaultMonthlyFee;
}

function isoDay(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function ledgerView(row) {
  return {
    id: row.id,
    month: row.month,
    amountDue: collectibleOf(row),
    amountPaid: Number(row.getDataValue("paidAmount")),
  };
}

/**
 * Where a student's ledger begins when it has no months yet: the later of
 * admission and the current session start (never older arrears by accident).
 */
async function ledgerStart(schoolId, student, fallback, transaction) {
  const session = await AcademicSessions.findOne({ where: { fkSchoolId: schoolId, isCurrent: true }, transaction });
  const candidates = [student.admittedOn, session && session.startDate].filter(Boolean).map((d) => monthStamp(isoDay(d)));
  return candidates.length ? candidates.sort().pop() : fallback;
}

/**
 * A month is due on the school's due day. A student admitted after that day
 * gets the same number of days from admission, so a new admission is never
 * overdue on day one.
 */
function dueDateFor(student, month, dueDay) {
  const standard = `${monthStamp(month)}-${String(dueDay).padStart(2, "0")}`;
  const admitted = student.admittedOn ? isoDay(student.admittedOn) : null;
  if (!admitted || monthStamp(admitted) !== monthStamp(month) || admitted <= standard) return standard;
  const grace = new Date(`${admitted}T00:00:00Z`);
  grace.setUTCDate(grace.getUTCDate() + Number(dueDay));
  return grace.toISOString().slice(0, 10);
}

/**
 * Create one bill (fee type) for a ledger month; returns the row when it is new, else null.
 * Applies Approved concessions when fees.concessionsEnabled. On RejectConflict, returns
 * { conflict: true, ... } without inserting (caller records the failure).
 */
async function createBill(schoolId, student, month, feeType, amountDue, dueDay, transaction) {
  const existing = await StudentFeeMonths.findOne({
    where: { fkStudentId: student.id, month, feeType },
    transaction,
  });
  if (existing) return null;

  const feesSettings = await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction });
  let base = Number(amountDue);
  let discount = 0;
  let net = base;
  let snapshot = null;
  const onDate = feeType === "Admission" && student.admittedOn
    ? String(student.admittedOn).slice(0, 10)
    : `${monthStamp(month)}-01`;

  if (feesSettings.concessionsEnabled) {
    const feeConcessionService = require("./fee_concession.service");
    const resolved = await feeConcessionService.resolveForBill(schoolId, student, feeType, base, onDate, { transaction });
    if (resolved.conflict) {
      return { conflict: true, feeType, month, conflictIds: resolved.conflictIds, snapshot: resolved.snapshot };
    }
    discount = resolved.discount;
    net = resolved.net;
    snapshot = resolved.snapshot;
  }

  const status = feeMonthStatus(
    { amountDue: net, amountPaid: 0, month },
    monthStamp(today()),
  );
  const row = await StudentFeeMonths.create(
    {
      fkSchoolId: schoolId,
      fkStudentId: student.id,
      month,
      feeType,
      baseAmount: base,
      discountAmount: discount,
      netAmount: net,
      adjustmentTotal: 0,
      collectibleAmount: net,
      concessionSnapshot: snapshot,
      paidAmount: 0,
      status,
      dueDate: dueDateFor(student, month, dueDay),
    },
    { transaction },
  );
  return row;
}

async function createMonth(schoolId, student, month, amountDue, dueDay, transaction) {
  return createBill(schoolId, student, month, "Tuition", amountDue, dueDay, transaction);
}

const sessionCache = new WeakMap();
/** The school's academic session that contains `month` (cached per transaction). */
async function sessionForMonth(schoolId, month, transaction) {
  const key = transaction || sessionCache;
  if (!sessionCache.has(key)) sessionCache.set(key, new Map());
  const cache = sessionCache.get(key);
  const cacheKey = `${schoolId}:${month}`;
  if (!cache.has(cacheKey)) {
    const day = `${month}-01`;
    cache.set(cacheKey, await AcademicSessions.findOne({
      where: { fkSchoolId: schoolId, startDate: { [Op.lte]: day }, endDate: { [Op.gte]: day } },
      order: [["startDate", "DESC"]],
      transaction,
    }));
  }
  return cache.get(cacheKey);
}

/**
 * Separately billed fees (Finance Step 4) added when a ledger month is first
 * created. Never back-filled into months that already exist.
 * - Admission: once, in the admission month, only for a student admitted on/after
 *   the Admission row took effect AND added after that row was created (existing
 *   students are never billed retroactively).
 * - Annual: once per academic session, in the first new month of the session
 *   where an Annual row is in force on the 1st.
 * - Exam: in month M when a live Exam row starts in (1st of previous month, 1st of M]
 *   - i.e. the first month it is in force - so each dated Exam row bills once.
 * The student fixed-fee override applies to tuition only.
 */
async function extraBillsFor(schoolId, student, month, transaction) {
  if (!student.fkClassId) return [];
  const bills = [];
  const first = `${month}-01`;
  const structure = await feeStructureService.inForce(student.fkClassId, first, { transaction });

  const admittedOn = student.admittedOn ? isoDay(student.admittedOn) : null;
  if (admittedOn && monthStamp(admittedOn) === month) {
    const admission = (await feeStructureService.inForce(student.fkClassId, admittedOn, { transaction, feeType: "Admission" })).get("Admission");
    const createdOf = (row) => row && (row.get("created_at") || row.get("createdAt"));
    const addedAfterFee = admission && createdOf(student) && new Date(createdOf(student)) >= new Date(createdOf(admission));
    if (admission && Number(admission.amount) > 0 && addedAfterFee) {
      const already = await StudentFeeMonths.count({ where: { fkStudentId: student.id, feeType: "Admission" }, paranoid: false, transaction });
      if (!already) bills.push(["Admission", Number(admission.amount)]);
    }
  }

  const annual = structure.get("Annual");
  if (annual && Number(annual.amount) > 0) {
    const session = await sessionForMonth(schoolId, month, transaction);
    const range = session
      ? { [Op.between]: [monthStamp(isoDay(session.startDate)), monthStamp(isoDay(session.endDate))] }
      : month;
    const already = await StudentFeeMonths.count({ where: { fkStudentId: student.id, feeType: "Annual", month: range }, paranoid: false, transaction });
    if (!already) bills.push(["Annual", Number(annual.amount)]);
  }

  const exam = structure.get("Exam");
  if (exam && Number(exam.amount) > 0 && exam.effectiveFrom > `${stepMonth(month, -1)}-01` && exam.effectiveFrom <= first) {
    bills.push(["Exam", Number(exam.amount)]);
  }
  return bills;
}

/** Statuses that accrue new fee months (SRS p15: Active is in fee generation). */
const BILLABLE = [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PENDING];

/**
 * Month a returning student starts paying again: the latest reactivation or
 * readmission. Months while Inactive / struck off are never back-filled (D2).
 */
async function resumeMonth(studentId, transaction) {
  const latest = await StudentStatusEvents.max("effectiveOn", {
    where: { fkStudentId: studentId, eventType: ["Reactivated", "Readmitted"] },
    transaction,
  });
  return latest ? monthStamp(isoDay(latest)) : null;
}

/**
 * Extend a billable student's ledger forward so it includes month `to`.
 * Gaps are only left for time spent Inactive or off roll.
 */
/**
 * Create any missing bills through `to`. Credit rule (Step 5): whenever new bills
 * are created here (monthly generation, catch-up billing at collection, enrollment)
 * the student's available credit is applied straight away to open bills, oldest
 * month first, under the `fees:{studentId}` lock. `actor` is only used for the audit.
 */
async function ensureMonthsThrough(schoolId, student, to, transaction, actor = null) {
  if (!BILLABLE.includes(student.status)) return [];
  const { dueDay } = await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction });
  const target = monthStamp(to);
  const last = await StudentFeeMonths.max("month", { where: { fkStudentId: student.id }, transaction });
  let month = last ? stepMonth(last, 1) : await ledgerStart(schoolId, student, target, transaction);
  const resume = await resumeMonth(student.id, transaction);
  if (resume && resume > month) month = resume;
  const created = [];
  const conflicts = [];
  for (; month <= target; month = stepMonth(month, 1)) {
    const amountDue = await monthlyFeeFor(schoolId, student, transaction, month);
    const tuition = await createMonth(schoolId, student, month, amountDue, dueDay, transaction);
    if (tuition && tuition.conflict) {
      conflicts.push({ studentId: student.id, ...tuition });
      continue; // do not add extras into a conflicted month either
    }
    if (!tuition) continue; // month already billed: never add fees to an existing month
    created.push(tuition);
    for (const [feeType, amount] of await extraBillsFor(schoolId, student, month, transaction)) {
      const bill = await createBill(schoolId, student, month, feeType, amount, dueDay, transaction);
      if (bill && bill.conflict) {
        conflicts.push({ studentId: student.id, ...bill });
        continue;
      }
      if (bill) created.push(bill);
    }
  }
  if (created.length) {
    await creditLedgerService.applyToOpenBills(actor || creditLedgerService.systemActor(schoolId), student.id, { transaction, currentMonth: monthStamp(today()) });
  }
  created.conflicts = conflicts;
  return created;
}

const money2 = (c) => fromCents(c);
const sumCents = (rows, pick) => rows.reduce((total, row) => total + cents(pick(row)), 0);

/**
 * Bulk-create the ledger up to `month` for every active student (optionally one class).
 * `dryRun` runs the exact same code in a transaction that is rolled back, so the
 * preview always matches what generation would write. A school-wide advisory lock
 * serialises generations; per-student locks keep payments and generation apart, and
 * the (student, month, fee_type) unique index is the last line against duplicates.
 */
async function runGeneration(actor, { month, classId }, { dryRun }) {
  const target = monthStamp(month);
  const where = { fkSchoolId: actor.schoolId, status: STUDENT_STATUS.ACTIVE };
  if (classId) where.fkClassId = classId;
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", { replacements: { key: `feegen:${actor.schoolId}` }, transaction });
    const students = await Students.findAll({ where, order: [["id", "ASC"]], transaction });
    const classIds = [...new Set(students.map((st) => st.fkClassId).filter(Boolean))];
    const classes = classIds.length ? await Classes.findAll({ where: { id: classIds }, attributes: ["id", "label"], transaction }) : [];
    const labels = new Map(classes.map((k) => [k.id, k.label]));
    const carried = students.length
      ? await StudentFeeMonths.findAll({
        where: { fkStudentId: students.map((st) => st.id), month: { [Op.lt]: target }, paidAmount: { [Op.lt]: col("collectible_amount") } },
        attributes: ["fkStudentId", "collectibleAmount", "netAmount", "paidAmount"],
        transaction,
      })
      : [];
    const carriedBy = new Map();
    for (const row of carried) {
      const owed = cents(collectibleOf(row)) - cents(row.getDataValue("paidAmount"));
      carriedBy.set(row.fkStudentId, (carriedBy.get(row.fkStudentId) || 0) + owed);
    }

    const byClass = new Map();
    const concessionConflicts = [];
    for (const student of students) {
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", { replacements: { key: `fees:${student.id}` }, transaction });
      const created = await ensureMonthsThrough(actor.schoolId, student, target, transaction, actor);
      if (created.conflicts?.length) concessionConflicts.push(...created.conflicts);
      const key = student.fkClassId || 0;
      if (!byClass.has(key)) {
        byClass.set(key, { classId: student.fkClassId, label: labels.get(student.fkClassId) || "No class", students: 0, billedStudents: 0, skippedStudents: 0, bills: 0, dueCents: 0, carriedCents: 0, byType: {}, sampleStudentId: student.id });
      }
      const group = byClass.get(key);
      group.students += 1;
      group.carriedCents += carriedBy.get(student.id) || 0;
      if (created.length) {
        group.billedStudents += 1;
        if (!group.sampleBilled) { group.sampleStudentId = student.id; group.sampleBilled = true; }
      } else group.skippedStudents += 1;
      group.bills += created.length;
      for (const row of created) {
        const amount = cents(collectibleOf(row));
        group.dueCents += amount;
        const t = (group.byType[row.feeType] ||= { bills: 0, cents: 0 });
        t.bills += 1;
        t.cents += amount;
      }
    }

    const groups = [...byClass.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const classesOut = groups.map((g) => ({
      classId: g.classId,
      label: g.label,
      students: g.students,
      billedStudents: g.billedStudents,
      skippedStudents: g.skippedStudents,
      bills: g.bills,
      totalDue: money2(g.dueCents),
      outstandingCarried: money2(g.carriedCents),
      byType: Object.fromEntries(Object.entries(g.byType).map(([k, v]) => [k, { bills: v.bills, amount: money2(v.cents) }])),
      sampleStudentId: g.sampleStudentId,
    }));
    const totals = {
      students: students.length,
      billedStudents: groups.reduce((n, g) => n + g.billedStudents, 0),
      skippedStudents: groups.reduce((n, g) => n + g.skippedStudents, 0),
      bills: groups.reduce((n, g) => n + g.bills, 0),
      totalDue: money2(groups.reduce((n, g) => n + g.dueCents, 0)),
      outstandingCarried: money2(groups.reduce((n, g) => n + g.carriedCents, 0)),
    };
    const result = {
      month: target,
      label: monthLabel(target),
      classId: classId || null,
      dryRun,
      students: students.length,
      classes: classesOut,
      totals,
      concessionConflicts,
    };

    if (dryRun) {
      await transaction.rollback();
    } else {
      await auditService.record(actor, `generated fee months up to ${target}: ${totals.bills} bills for ${totals.billedStudents} students`.slice(0, 100), {
        entityType: "student_fee_month",
        metadata: { month: target, classId: classId || null, students: totals.students, billedStudents: totals.billedStudents, skippedStudents: totals.skippedStudents, bills: totals.bills, totalDue: totals.totalDue },
      }, { transaction });
      await transaction.commit();
    }
    return can(actor.role, "fees.totals") ? result : withoutMoney(result);
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    throw err;
  }
}

/** Accountants see counts only: no school-wide or class money totals (earlier rule: no totals anywhere). */
function withoutMoney(result) {
  const MONEY = ["totalDue", "outstandingCarried"];
  const omit = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !MONEY.includes(k)));
  return {
    ...result,
    classes: result.classes.map((g) => ({
      ...omit(g),
      byType: Object.fromEntries(Object.entries(g.byType || {}).map(([k, v]) => [k, { bills: v.bills }])),
    })),
    totals: omit(result.totals),
    amountsHidden: true,
  };
}

async function generateMonths(actor, { month, classId }) {
  return runGeneration(actor, { month, classId }, { dryRun: false });
}

async function previewGeneration(actor, { month, classId }) {
  return runGeneration(actor, { month, classId }, { dryRun: true });
}

/**
 * Student ledger: every month with its bills (tuition and separately billed
 * fees), due / paid / outstanding and status, plus totals and credit balance.
 */
async function studentLedger(user, studentId) {
  const student = await accessService.assertStudentAccess(user, studentId);
  const [rows, klass, creditBalance, creditHistory] = await Promise.all([
    StudentFeeMonths.findAll({ where: { fkStudentId: student.id }, order: [["month", "ASC"], ["id", "ASC"]] }),
    student.fkClassId ? Classes.findByPk(student.fkClassId, { attributes: ["id", "label"] }) : null,
    creditLedgerService.balance(user.schoolId, student.id),
    creditLedgerService.history(user.schoolId, student.id),
  ]);
  const currentMonth = monthStamp(today());
  const months = [];
  for (const row of rows) {
    const bill = presentMonth(row, currentMonth);
    let entry = months[months.length - 1];
    if (!entry || entry.month !== bill.month) {
      entry = { month: bill.month, label: bill.label, dueCents: 0, paidCents: 0, bills: [] };
      months.push(entry);
    }
    entry.dueCents += cents(bill.amountDue);
    entry.paidCents += cents(bill.amountPaid);
    entry.bills.push({
      id: bill.id,
      feeType: bill.feeType,
      due: bill.amountDue,
      paid: bill.amountPaid,
      outstanding: bill.balance,
      status: bill.status,
      dueDate: bill.dueDate,
      originalNet: bill.originalNet,
      adjustmentTotal: bill.adjustmentTotal,
      discountAmount: bill.discountAmount,
    });
  }
  const monthsOut = months.map(({ dueCents, paidCents, ...m }) => ({
    ...m,
    due: fromCents(dueCents),
    paid: fromCents(paidCents),
    outstanding: fromCents(Math.max(0, dueCents - paidCents)),
    status: feeMonthStatus({ amountDue: fromCents(dueCents), amountPaid: fromCents(paidCents), month: m.month }, currentMonth),
  }));
  const due = sumCents(rows, (r) => collectibleOf(r));
  const paid = sumCents(rows, (r) => r.getDataValue("paidAmount"));
  const owed = rows.reduce((n, r) => n + Math.max(0, cents(collectibleOf(r)) - cents(r.getDataValue("paidAmount"))), 0);
  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      status: student.status,
      class: klass ? { id: klass.id, label: klass.label } : null,
    },
    months: monthsOut,
    summary: {
      totalDue: fromCents(due),
      totalPaid: fromCents(paid),
      outstanding: fromCents(owed),
      creditBalance: creditBalance,
      netBalance: fromCents(owed - cents(creditBalance)),
      openMonths: monthsOut.filter((m) => m.outstanding > 0).length,
    },
    // Every credit movement, newest first, with the running balance after it.
    creditHistory: creditHistory.reverse(),
  };
}

async function listMonths(user, studentId) {
  if (studentId) {
    const student = await accessService.assertStudentAccess(user, studentId);
    const rows = await StudentFeeMonths.findAll({ where: { fkStudentId: student.id }, order: [["month", "ASC"], ["id", "ASC"]] });
    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo },
      months: rows.map((row) => presentMonth(row)),
    };
  }
  const where = { fkSchoolId: user.schoolId };
  if (user.role === USER_ROLES.PARENT) {
    where.fkStudentId = await accessService.linkedStudentIds(user);
  }
  const rows = await StudentFeeMonths.findAll({ where, order: [["month", "ASC"], ["id", "ASC"]] });
  return rows.map((row) => ({
    ...presentMonth(row),
    studentId: String(row.fkStudentId),
  }));
}

// ---- recording -------------------------------------------------------------

/**
 * Allocate a payment (Step 5 rules):
 *  1. bill catch-up through the payment month (new bills take available credit);
 *  2. when `applyCredit` is set, existing credit pays open bills first, oldest first;
 *  3. the cash pays open bills oldest first (or per the super admin's manual lines);
 *  4. whatever is left becomes student credit (a `Credit` row linked to the payment).
 *     It is no longer used to pre-pay future months; credit is applied as those
 *     months are billed. `unallocated_amount` keeps the part of this payment that
 *     went to credit, as history; the live balance is the credit ledger.
 */
async function allocate(actor, payment, student, manualLines, transaction, { applyCredit = false } = {}) {
  const currentMonth = monthStamp(payment.paidOn);
  await creditLedgerService.lockStudent(student.id, transaction);
  await ensureMonthsThrough(actor.schoolId, student, currentMonth, transaction, actor);
  const creditApplied = applyCredit
    ? await creditLedgerService.applyToOpenBills(actor, student.id, { transaction, paymentId: payment.id, currentMonth })
    : [];

  const openMonths = async () =>
    StudentFeeMonths.findAll({
      where: { fkStudentId: student.id, paidAmount: { [Op.lt]: col("collectible_amount") } },
      order: [["month", "ASC"], ["id", "ASC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

  const months = await openMonths();
  const paymentAmount = Number(payment.getDataValue("amountPaid"));
  let plan;
  if (manualLines) {
    plan = validateManualPlan(months.map(ledgerView), paymentAmount, manualLines);
    if (plan.error) throw new ApiError(400, plan.error);
  } else {
    plan = planOldestFirst(months.map(ledgerView), paymentAmount);
  }

  const byId = new Map(months.map((m) => [m.id, m]));
  for (const line of plan.lines) {
    const month = byId.get(line.feeMonthId);
    await FeeAllocations.create(
      { fkSchoolId: actor.schoolId, fkPaymentId: payment.id, fkFeeMonthId: month.id, amount: line.amount },
      { transaction },
    );
    const amountPaid = fromCents(cents(month.getDataValue("paidAmount")) + cents(line.amount));
    await month.update(
      {
        paidAmount: amountPaid,
        status: feeMonthStatus({
          amountDue: collectibleOf(month),
          amountPaid,
          month: month.month,
        }, currentMonth),
      },
      { transaction },
    );
  }
  const covered = plan.lines.map((l) => monthLabel(byId.get(l.feeMonthId).month));
  await payment.update({ unallocatedAmount: plan.leftover, period: covered.join(", ") || null }, { transaction });
  await auditService.record(
    actor,
    // audit_logs.action is VARCHAR(100); a payment spanning several months would overflow it.
    `allocated receipt ${payment.ref} (${manualLines ? "manual" : "oldest first"}) to ${covered.join(", ") || "no month"}`.slice(0, 100),
    {
      entityType: "fee_payment",
      entityId: payment.id,
      metadata: { studentId: student.id, mode: manualLines ? ALLOCATION_MODE.MANUAL : ALLOCATION_MODE.AUTO, lines: plan.lines, leftover: plan.leftover, creditApplied },
    },
    { transaction },
  );
  if (plan.leftover > 0) {
    await creditLedgerService.addCredit(actor, { studentId: student.id, amount: plan.leftover, paymentId: payment.id, source: "payment", notes: `Excess of receipt ${payment.ref}` }, { transaction });
  }
}

function newReceiptNo(date) {
  return `RCPT-${date.replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Record a payment (§9.1). Duplicate submissions carrying the same
 * idempotency key (offline sync, double-click) return the original receipt.
 */
async function duplicateOf(actor, key) {
  if (!key) return null;
  const existing = await FeePayments.findOne({ where: { idempotencyKey: key, fkSchoolId: actor.schoolId } });
  return existing ? { duplicate: true, receipt: await receipt(actor, existing.id) } : null;
}

/**
 * `outer` (offline import): run inside the caller's transaction as a savepoint, so the
 * import row update and its audit commit together with the payment.
 */
async function recordPayment(actor, data, { dryRun = false, transaction: outer = null } = {}) {
  if (!dryRun) {
    const dup = await duplicateOf(actor, data.idempotencyKey);
    if (dup) return dup;
  }
  if (data.allocations && !can(actor.role, "fees.payments.allocate_manual")) {
    throw new ApiError(403, "Only the super admin can record an explicit allocation.");
  }
  const student = await Students.findOne({ where: { id: data.studentId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const paidOn = data.paidOn || today();

  const transaction = await sequelize.transaction(outer ? { transaction: outer } : {});
  let paymentId;
  try {
    const payment = await FeePayments.create(
      {
        fkSchoolId: actor.schoolId,
        fkStudentId: student.id,
        ref: newReceiptNo(paidOn),
        amount: data.amount,
        method: data.method || "Cash",
        status: PAYMENT_STATUS.PAID,
        paidOn,
        notes: data.notes || null,
        referenceNo: data.referenceNo || null,
        fkRecordedByUserId: actor.id,
        idempotencyKey: dryRun ? null : data.idempotencyKey || null,
        allocationMode: data.allocations ? ALLOCATION_MODE.MANUAL : ALLOCATION_MODE.AUTO,
      },
      { transaction },
    );
    await allocate(actor, payment, student, data.allocations, transaction, { applyCredit: Boolean(data.applyCredit) });
    paymentId = payment.id;
    if (dryRun) {
      // Same code path as the real thing, rolled back: the preview cannot drift.
      const view = await receipt(actor, paymentId, { transaction });
      await transaction.rollback();
      return { preview: true, allocation: { ...view, id: null, receiptNo: null } };
    }
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    // Two submissions with the same key raced past the first check: return the winner.
    if (error.name === "SequelizeUniqueConstraintError" && data.idempotencyKey && !dryRun) {
      const dup = await duplicateOf(actor, data.idempotencyKey);
      if (dup) return dup;
    }
    throw error;
  }
  return { duplicate: false, receipt: await receipt(actor, paymentId, { transaction: outer || undefined }) };
}

/** Dry run of recordPayment: the exact allocation (credit used, months, new credit). */
async function previewPayment(actor, data) {
  return recordPayment(actor, data, { dryRun: true });
}

/** Confirm a Pending payment (e.g. imported bank transfer) and allocate it. */
async function confirmPayment(actor, id) {
  await sequelize.transaction(async (transaction) => {
    const payment = await FeePayments.findOne({ where: { id, fkSchoolId: actor.schoolId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) throw new ApiError(404, "Payment not found");
    if (payment.status === PAYMENT_STATUS.PAID) throw new ApiError(400, "Payment is already confirmed.");
    const student = await Students.findByPk(payment.fkStudentId, { transaction });
    await payment.update({ status: PAYMENT_STATUS.PAID, paidOn: payment.paidOn || today() }, { transaction });
    await allocate(actor, payment, student, null, transaction);
  });
  return receipt(actor, id);
}

// ---- reading ---------------------------------------------------------------

const paymentInclude = [
  { model: Students, as: "student", attributes: studentAttributes },
  { model: Users, as: "recordedBy", attributes: ["id", "firstName", "lastName"] },
  {
    model: FeeAllocations,
    as: "allocations",
    attributes: ["id", "allocatedAmount"],
    include: [{ model: StudentFeeMonths, as: "feeMonth", attributes: ["id", "month", "feeType"] }],
  },
];

function presentPayment(payment) {
  const p = payment.get({ plain: true });
  const months = [...p.allocations].sort((a, b) => a.feeMonth.month.localeCompare(b.feeMonth.month));
  return {
    id: p.id,
    receiptNo: p.receiptNo || p.ref,
    paymentDate: p.paymentDate || p.paidOn,
    status: p.status || "Paid",
    method: p.paymentMethod || p.method,
    feeType: p.feeType || p.type,
    amount: Number(p.amountPaid ?? p.amount),
    unallocatedAmount: Number(p.unallocatedAmount),
    allocationMode: p.allocationMode,
    feeMonths: months.map((a) => ({ id: a.feeMonth.id, month: a.feeMonth.month, label: monthLabel(a.feeMonth.month), feeType: a.feeMonth.feeType, amount: Number(a.amount ?? a.allocatedAmount) })),
    student: p.student && {
      id: p.student.id,
      name: `${p.student.firstName} ${p.student.lastName}`,
      admissionNo: p.student.admissionNo,
    },
    recordedBy: p.recordedBy && { id: p.recordedBy.id, name: `${p.recordedBy.firstName} ${p.recordedBy.lastName}` },
    notes: p.notes,
  };
}

async function paymentScope(user) {
  const where = { fkSchoolId: user.schoolId };
  if (user.role === USER_ROLES.ACCOUNTANT) where.fkRecordedByUserId = user.id;
  if (user.role === USER_ROLES.PARENT) where.fkStudentId = await accessService.linkedStudentIds(user);
  return where;
}

/** Individual receipt (§9.3). Accountants may only open receipts they recorded. */
async function receipt(user, id, { transaction } = {}) {
  const payment = await FeePayments.findOne({ where: { ...(await paymentScope(user)), id }, include: paymentInclude, transaction });
  if (!payment) throw new ApiError(404, "Receipt not found");
  const view = presentPayment(payment);
  const movements = await StudentCreditLedger.findAll({
    where: { fkPaymentId: payment.id, source: "payment" },
    include: [{ model: StudentFeeMonths, as: "feeMonth", attributes: ["id", "month", "feeType"], required: false }],
    order: [["id", "ASC"]],
    transaction,
  });
  const applied = movements.filter((m) => m.entryType === "Applied");
  view.creditApplied = applied.map((m) => ({ feeMonthId: m.fkFeeMonthId, month: m.feeMonth?.month, label: m.feeMonth ? monthLabel(m.feeMonth.month) : null, feeType: m.feeMonth?.feeType, amount: Number(m.amount) }));
  view.creditAppliedTotal = fromCents(applied.reduce((n, m) => n + cents(m.amount), 0));
  view.creditAdded = fromCents(movements.filter((m) => m.entryType === "Credit").reduce((n, m) => n + cents(m.amount), 0));
  view.creditBalance = await creditLedgerService.balance(payment.fkSchoolId, payment.fkStudentId, { transaction });
  return view;
}

async function listPayments(user, { studentId, date, status } = {}) {
  const where = await paymentScope(user);
  if (studentId) {
    await accessService.assertStudentAccess(user, studentId);
    where.fkStudentId = studentId;
  }
  if (date) where.paymentDate = date;
  void status;
  const rows = await FeePayments.findAll({ where, include: paymentInclude, order: [["paymentDate", "DESC"], ["id", "DESC"]] });
  return rows.map(presentPayment);
}

/**
 * The accountant's own collection sheet for one day (§9.2): row data only.
 * Deliberately no sum, count-of-money or any other aggregate (BR-11).
 */
async function myCollections(actor, { date }) {
  const day = date || today();
  const rows = await FeePayments.findAll({
    where: { fkSchoolId: actor.schoolId, fkRecordedByUserId: actor.id, paymentDate: day, status: PAYMENT_STATUS.PAID },
    include: paymentInclude,
    order: [["id", "ASC"]],
  });
  return {
    date: day,
    rows: rows.map(presentPayment).map((p) => ({
      id: p.id,
      receiptNo: p.receiptNo,
      studentName: p.student.name,
      admissionNo: p.student.admissionNo,
      paymentDate: p.paymentDate,
      feeMonths: p.feeMonths.map((m) => m.label),
      amount: p.amount,
      method: p.method,
    })),
  };
}

/** Super admin view of a day's collections with totals. */
async function collections(actor, { date, recordedBy }) {
  // `paidOn` is a virtual alias; queries must use the real `paymentDate` column.
  const where = { fkSchoolId: actor.schoolId, paymentDate: date || today(), status: PAYMENT_STATUS.PAID };
  if (recordedBy) where.fkRecordedByUserId = recordedBy;
  const rows = (await FeePayments.findAll({ where, include: paymentInclude, order: [["id", "ASC"]] })).map(presentPayment);
  const byRecorder = {};
  for (const r of rows) {
    const key = r.recordedBy ? r.recordedBy.name : "Unknown";
    byRecorder[key] = fromCents(cents(byRecorder[key] || 0) + cents(r.amount));
  }
  return {
    date: where.paymentDate,
    rows,
    totals: { receipts: rows.length, amount: fromCents(rows.reduce((s, r) => s + cents(r.amount), 0)), byRecorder },
  };
}

/** Super admin school-wide fee position (UR-01: overall totals). */
async function summary(actor, { month } = {}) {
  const rangeStart = firstOfMonth(month || today());
  const target = monthStamp(rangeStart);
  const [collected, ledger, statuses] = await Promise.all([
    FeePayments.sum("amountPaid", {
      where: { fkSchoolId: actor.schoolId, status: PAYMENT_STATUS.PAID, paymentDate: { [Op.gte]: rangeStart, [Op.lt]: addMonths(rangeStart, 1) } },
    }),
    StudentFeeMonths.findOne({
      where: { fkSchoolId: actor.schoolId, month: { [Op.lte]: target } },
      attributes: [[fn("SUM", col("collectible_amount")), "due"], [fn("SUM", col("paid_amount")), "paid"]],
      raw: true,
    }),
    StudentFeeMonths.findAll({
      where: { fkSchoolId: actor.schoolId, month: target },
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
  ]);
  return {
    month: target,
    collectedThisMonth: Number(collected || 0),
    outstandingToDate: fromCents(cents(ledger.due) - cents(ledger.paid)),
    monthStatusCounts: Object.fromEntries(statuses.map((s) => [s.status, Number(s.count)])),
  };
}

/** Months fully paid up to and including `month` — used by the result gate. */
async function isPaidThrough(schoolId, studentId, month) {
  const open = await StudentFeeMonths.count({
    where: { fkSchoolId: schoolId, fkStudentId: studentId, month: { [Op.lte]: monthStamp(month) }, paidAmount: { [Op.lt]: col("collectible_amount") } },
  });
  return open === 0;
}

async function isMonthPaid(schoolId, studentId, month) {
  // A month can carry several bills (tuition + separately billed fees): all must be paid.
  const rows = await StudentFeeMonths.findAll({ where: { fkSchoolId: schoolId, fkStudentId: studentId, month: monthStamp(month) } });
  return rows.length > 0 && rows.every((row) => cents(row.getDataValue("paidAmount")) >= cents(collectibleOf(row)));
}

/** Open the ledger through the student's admission month. Used by enrollment. */
async function openLedger(schoolId, student, transaction) {
  const start = await ledgerStart(schoolId, student, monthStamp(student.admittedOn || today()), transaction);
  await ensureMonthsThrough(schoolId, student, start, transaction);
}

// ---- collect desk (Step 5) ---------------------------------------------------

const studentName = (s) => `${s.firstName} ${s.lastName}`.trim();

/** Open balance and credit per student, in one query. */
async function balancesFor(schoolId, studentIds, currentMonth) {
  if (!studentIds.length) return new Map();
  const [rows] = await sequelize.query(
    `SELECT s.id,
            COALESCE((SELECT SUM(GREATEST(m.collectible_amount - m.paid_amount, 0)) FROM student_fee_months m
                       WHERE m.fk_student_id = s.id AND m.archived_at IS NULL AND m.month <= :month), 0) AS outstanding,
            COALESCE((SELECT COUNT(*) FROM student_fee_months m
                       WHERE m.fk_student_id = s.id AND m.archived_at IS NULL AND m.paid_amount < m.collectible_amount), 0)::int AS open_bills,
            COALESCE((SELECT SUM(CASE WHEN l.entry_type = 'Credit' THEN l.amount ELSE -l.amount END) FROM student_credit_ledger l
                       WHERE l.fk_student_id = s.id), 0) AS credit
       FROM students s WHERE s.fk_school_id = :schoolId AND s.id IN (:ids)`,
    { replacements: { schoolId, ids: studentIds, month: currentMonth } },
  );
  return new Map(rows.map((r) => [Number(r.id), { outstanding: Number(r.outstanding), openBills: r.open_bills, creditBalance: Number(r.credit) }]));
}

/**
 * Collect Fee header cards. Counts for everyone at the desk; money only as allowed:
 * the super admin gets today's school collection, an accountant only their own.
 */
async function collectOverview(actor) {
  const day = today();
  const currentMonth = monthStamp(day);
  const [[counts]] = await sequelize.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM student_fee_months m WHERE m.fk_student_id = s.id AND m.archived_at IS NULL
                                           AND m.month <= :month AND m.paid_amount < m.collectible_amount))::int AS outstanding
       FROM students s WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL AND s.status = :active`,
    { replacements: { schoolId: actor.schoolId, month: currentMonth, active: STUDENT_STATUS.ACTIVE } },
  );
  const out = { date: day, totalStudents: counts.total, withOutstanding: counts.outstanding };
  const where = { fkSchoolId: actor.schoolId, paymentDate: day, status: PAYMENT_STATUS.PAID };
  if (can(actor.role, "fees.totals")) {
    const rows = await FeePayments.findAll({ where, attributes: ["amountPaid"] });
    out.todayCollection = { receipts: rows.length, amount: fromCents(sumCents(rows, (r) => r.getDataValue("amountPaid"))) };
  } else {
    const rows = await FeePayments.findAll({ where: { ...where, fkRecordedByUserId: actor.id }, attributes: ["amountPaid"] });
    out.myCollectionToday = { receipts: rows.length, amount: fromCents(sumCents(rows, (r) => r.getDataValue("amountPaid"))) };
  }
  return out;
}

async function searchStudents(actor, { q }) {
  const term = `%${String(q).trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const students = await Students.findAll({
    where: {
      fkSchoolId: actor.schoolId,
      [Op.or]: [
        { admissionNo: { [Op.iLike]: term } },
        { firstName: { [Op.iLike]: term } },
        { lastName: { [Op.iLike]: term } },
        sequelize.where(fn("concat", col("first_name"), " ", col("last_name")), { [Op.iLike]: term }),
      ],
    },
    order: [["firstName", "ASC"], ["lastName", "ASC"], ["id", "ASC"]],
    limit: 20,
  });
  const classIds = [...new Set(students.map((s) => s.fkClassId).filter(Boolean))];
  const classes = classIds.length ? await Classes.findAll({ where: { id: classIds }, attributes: ["id", "label"] }) : [];
  const labels = new Map(classes.map((k) => [k.id, k.label]));
  const balances = await balancesFor(actor.schoolId, students.map((s) => s.id), monthStamp(today()));
  return students.map((s) => ({
    id: s.id,
    name: studentName(s),
    admissionNo: s.admissionNo,
    status: s.status,
    class: s.fkClassId ? { id: s.fkClassId, label: labels.get(s.fkClassId) || null } : null,
    ...(balances.get(s.id) || { outstanding: 0, openBills: 0, creditBalance: 0 }),
  }));
}

/** Everything the desk needs for one student: open bills, credit, recent receipts (scoped). */
async function collectContext(actor, studentId) {
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const currentMonth = monthStamp(today());
  const [open, klass, creditBalance, credits, recent] = await Promise.all([
    StudentFeeMonths.findAll({ where: { fkStudentId: student.id, paidAmount: { [Op.lt]: col("collectible_amount") } }, order: [["month", "ASC"], ["id", "ASC"]] }),
    student.fkClassId ? Classes.findByPk(student.fkClassId, { attributes: ["id", "label"] }) : null,
    creditLedgerService.balance(actor.schoolId, student.id),
    creditLedgerService.history(actor.schoolId, student.id),
    FeePayments.findAll({ where: { ...(await paymentScope(actor)), fkStudentId: student.id }, include: paymentInclude, order: [["paymentDate", "DESC"], ["id", "DESC"]], limit: 5 }),
  ]);
  const bills = open.map((row) => presentMonth(row, currentMonth));
  return {
    student: { id: student.id, name: studentName(student), admissionNo: student.admissionNo, status: student.status, class: klass ? { id: klass.id, label: klass.label } : null },
    openBills: bills,
    outstanding: fromCents(sumCents(bills, (b) => b.balance)),
    creditBalance,
    creditHistory: credits.slice(-10).reverse(),
    recentReceipts: recent.map(presentPayment).map((p) => ({ id: p.id, receiptNo: p.receiptNo, paymentDate: p.paymentDate, amount: p.amount, method: p.method })),
  };
}

// The Excel fee import (offline sync) lives in fee_import.service.js.

module.exports = {
  previewGeneration,
  studentLedger,
  dueDateFor,
  generateMonths,
  openLedger,
  listMonths,
  recordPayment,
  previewPayment,
  collectOverview,
  searchStudents,
  collectContext,
  confirmPayment,
  receipt,
  listPayments,
  myCollections,
  collections,
  summary,
  isPaidThrough,
  isMonthPaid,
  monthLabel,
  monthlyFeeFor,
};
