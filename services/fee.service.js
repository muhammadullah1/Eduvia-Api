"use strict";

const crypto = require("crypto");
const { Op, fn, col } = require("sequelize");
const {
  FeePayments,
  FeeAllocations,
  StudentFeeMonths,
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

const studentAttributes = ["id", "firstName", "lastName", "admissionNo", "fkClassId"];

function presentMonth(row, currentMonth = firstOfMonth(today())) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const amountDue = Number(plain.netAmount ?? plain.amountDue ?? 0);
  const amountPaid = Number(plain.paidAmount ?? plain.amountPaid ?? 0);
  const view = { ...plain, amountDue, amountPaid };
  return {
    id: plain.id,
    month: plain.month,
    label: monthLabel(plain.month),
    feeType: plain.feeType,
    amountDue,
    amountPaid,
    balance: fromCents(outstanding(view)),
    status: feeMonthStatus(view, currentMonth),
    dueDate: plain.dueDate,
  };
}

async function monthlyFeeFor(schoolId, student, transaction) {
  const klass = student.fkClassId ? await Classes.findByPk(student.fkClassId, { transaction }) : null;
  if (klass && Number(klass.monthlyFee) > 0) return Number(klass.monthlyFee);
  return (await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction })).defaultMonthlyFee;
}

function isoDay(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/**
 * Where a student's ledger begins when it has no months yet: the later of
 * admission and the current session start (never older arrears by accident).
 */
async function ledgerStart(schoolId, student, fallback, transaction) {
  const session = await AcademicSessions.findOne({ where: { fkSchoolId: schoolId, isCurrent: true }, transaction });
  const candidates = [student.admittedOn, session && session.startDate].filter(Boolean).map((d) => firstOfMonth(isoDay(d)));
  return candidates.length ? candidates.sort().pop() : fallback;
}

async function createMonth(schoolId, student, month, amountDue, dueDay, transaction) {
  await StudentFeeMonths.findOrCreate({
    where: { fkStudentId: student.id, month, feeType: "Tuition" },
    defaults: {
      fkSchoolId: schoolId,
      amountDue,
      status: FEE_MONTH_STATUS.UNPAID,
      dueDate: `${month.slice(0, 7)}-${String(dueDay).padStart(2, "0")}`,
    },
    transaction,
  });
}

/** Extend a student's ledger forward (no gaps) so it includes month `to`. */
async function ensureMonthsThrough(schoolId, student, to, transaction) {
  const { dueDay } = await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction });
  const amountDue = await monthlyFeeFor(schoolId, student, transaction);
  const last = await StudentFeeMonths.max("month", { where: { fkStudentId: student.id }, transaction });
  let month = last ? addMonths(isoDay(last), 1) : await ledgerStart(schoolId, student, to, transaction);
  for (; month <= to; month = addMonths(month, 1)) {
    await createMonth(schoolId, student, month, amountDue, dueDay, transaction);
  }
}

/** Bulk-create the ledger up to `month` for every active student. */
async function generateMonths(actor, { month, classId }) {
  const target = firstOfMonth(month);
  const where = { fkSchoolId: actor.schoolId, status: STUDENT_STATUS.ACTIVE };
  if (classId) where.fkClassId = classId;
  const students = await Students.findAll({ where });
  await sequelize.transaction(async (transaction) => {
    for (const student of students) {
      await ensureMonthsThrough(actor.schoolId, student, target, transaction);
    }
  });
  await auditService.record(actor, `generated fee months up to ${target.slice(0, 7)}`, {
    entityType: "student_fee_month",
    metadata: { month: target, classId: classId || null, students: students.length },
  });
  return { students: students.length, month: target };
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

async function allocate(actor, payment, student, manualLines, transaction) {
  const currentMonth = firstOfMonth(payment.paidOn);
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", {
    replacements: { key: `fees:${student.id}` },
    transaction,
  });
  await ensureMonthsThrough(actor.schoolId, student, currentMonth, transaction);

  const openMonths = async () =>
    StudentFeeMonths.findAll({
      where: { fkStudentId: student.id, amountPaid: { [Op.lt]: col("amount_due") } },
      order: [["month", "ASC"], ["id", "ASC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

  let months = await openMonths();
  let plan;
  if (manualLines) {
    plan = validateManualPlan(months.map((m) => m.get({ plain: true })), payment.amount, manualLines);
    if (plan.error) throw new ApiError(400, plan.error);
  } else {
    plan = planOldestFirst(months.map((m) => m.get({ plain: true })), payment.amount);
    const { maxAdvanceMonths } = await settingsService.get(actor.schoolId, SETTING_KEYS.FEES, { transaction });
    let horizon = currentMonth;
    // Money beyond everything owed pre-pays upcoming months (status Advance).
    for (let i = 0; plan.leftover > 0 && i < maxAdvanceMonths; i += 1) {
      horizon = addMonths(horizon, 1);
      await ensureMonthsThrough(actor.schoolId, student, horizon, transaction);
      months = await openMonths();
      plan = planOldestFirst(months.map((m) => m.get({ plain: true })), payment.amount);
    }
  }

  const byId = new Map(months.map((m) => [m.id, m]));
  for (const line of plan.lines) {
    const month = byId.get(line.feeMonthId);
    await FeeAllocations.create(
      { fkSchoolId: actor.schoolId, fkPaymentId: payment.id, fkFeeMonthId: month.id, amount: line.amount },
      { transaction },
    );
    const amountPaid = fromCents(cents(month.amountPaid) + cents(line.amount));
    await month.update(
      { amountPaid, status: feeMonthStatus({ amountDue: month.amountDue, amountPaid, month: month.month }, currentMonth) },
      { transaction },
    );
  }
  const covered = plan.lines.map((l) => monthLabel(byId.get(l.feeMonthId).month));
  await payment.update({ unallocatedAmount: plan.leftover, period: covered.join(", ") || null }, { transaction });
  await auditService.record(
    actor,
    `allocated receipt ${payment.ref} (${manualLines ? "manual" : "oldest first"}) to ${covered.join(", ") || "no month"}`,
    {
      entityType: "fee_payment",
      entityId: payment.id,
      metadata: { studentId: student.id, mode: manualLines ? ALLOCATION_MODE.MANUAL : ALLOCATION_MODE.AUTO, lines: plan.lines, leftover: plan.leftover },
    },
    { transaction },
  );
}

function newReceiptNo(date) {
  return `RCPT-${date.replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Record a payment (§9.1). Duplicate submissions carrying the same
 * idempotency key (offline sync, double-click) return the original receipt.
 */
async function recordPayment(actor, data) {
  if (data.idempotencyKey) {
    const existing = await FeePayments.findOne({ where: { idempotencyKey: data.idempotencyKey, fkSchoolId: actor.schoolId } });
    if (existing) return { duplicate: true, receipt: await receipt(actor, existing.id) };
  }
  if (data.allocations && !can(actor.role, "fees.payments.allocate_manual")) {
    throw new ApiError(403, "Only the super admin can record an explicit allocation.");
  }
  const student = await Students.findOne({ where: { id: data.studentId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const paidOn = data.paidOn || today();

  const paymentId = await sequelize.transaction(async (transaction) => {
    const payment = await FeePayments.create(
      {
        fkSchoolId: actor.schoolId,
        fkStudentId: student.id,
        ref: newReceiptNo(paidOn),
        type: data.feeType || "Tuition",
        amount: data.amount,
        method: data.method || "Cash",
        status: PAYMENT_STATUS.PAID,
        paidOn,
        notes: data.notes || null,
        fkRecordedByUserId: actor.id,
        idempotencyKey: data.idempotencyKey || null,
        allocationMode: data.allocations ? ALLOCATION_MODE.MANUAL : ALLOCATION_MODE.AUTO,
      },
      { transaction },
    );
    await allocate(actor, payment, student, data.allocations, transaction);
    return payment.id;
  });
  return { duplicate: false, receipt: await receipt(actor, paymentId) };
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
    feeMonths: months.map((a) => ({ id: a.feeMonth.id, month: a.feeMonth.month, label: monthLabel(a.feeMonth.month), amount: Number(a.amount ?? a.allocatedAmount) })),
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
async function receipt(user, id) {
  const payment = await FeePayments.findOne({ where: { ...(await paymentScope(user)), id }, include: paymentInclude });
  if (!payment) throw new ApiError(404, "Receipt not found");
  return presentPayment(payment);
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
    where: { fkSchoolId: actor.schoolId, fkRecordedByUserId: actor.id, paidOn: day, status: PAYMENT_STATUS.PAID },
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
  const where = { fkSchoolId: actor.schoolId, paidOn: date || today(), status: PAYMENT_STATUS.PAID };
  if (recordedBy) where.fkRecordedByUserId = recordedBy;
  const rows = (await FeePayments.findAll({ where, include: paymentInclude, order: [["id", "ASC"]] })).map(presentPayment);
  const byRecorder = {};
  for (const r of rows) {
    const key = r.recordedBy ? r.recordedBy.name : "Unknown";
    byRecorder[key] = fromCents(cents(byRecorder[key] || 0) + cents(r.amount));
  }
  return {
    date: where.paidOn,
    rows,
    totals: { receipts: rows.length, amount: fromCents(rows.reduce((s, r) => s + cents(r.amount), 0)), byRecorder },
  };
}

/** Super admin school-wide fee position (UR-01: overall totals). */
async function summary(actor, { month } = {}) {
  const target = firstOfMonth(month || today());
  const [collected, ledger, statuses] = await Promise.all([
    FeePayments.sum("amount", {
      where: { fkSchoolId: actor.schoolId, status: PAYMENT_STATUS.PAID, paidOn: { [Op.gte]: target, [Op.lt]: addMonths(target, 1) } },
    }),
    StudentFeeMonths.findOne({
      where: { fkSchoolId: actor.schoolId, month: { [Op.lte]: target } },
      attributes: [[fn("SUM", col("amount_due")), "due"], [fn("SUM", col("amount_paid")), "paid"]],
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
    where: { fkSchoolId: schoolId, fkStudentId: studentId, month: { [Op.lte]: firstOfMonth(month) }, amountPaid: { [Op.lt]: col("amount_due") } },
  });
  return open === 0;
}

async function isMonthPaid(schoolId, studentId, month) {
  const row = await StudentFeeMonths.findOne({ where: { fkSchoolId: schoolId, fkStudentId: studentId, month: firstOfMonth(month) } });
  return Boolean(row) && cents(row.amountPaid) >= cents(row.amountDue);
}

module.exports = {
  generateMonths,
  listMonths,
  recordPayment,
  confirmPayment,
  receipt,
  listPayments,
  myCollections,
  collections,
  summary,
  isPaidThrough,
  isMonthPaid,
  monthLabel,
};
