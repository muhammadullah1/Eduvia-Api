"use strict";

const { Op, col } = require("sequelize");
const { StudentCreditLedger, StudentFeeMonths, FeePayments, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { feeMonthStatus, cents, fromCents } = require("../utils/fee_allocation");

/**
 * Student credit (Finance Step 5). Append-only ledger: `Credit` rows add money
 * (credit in: excess payments, import, backfill), `Applied` rows spend it on a
 * fee month (always linked to that month), `Reversal` rows exist for corrections.
 * Credit only reduces fees; it is never refunded.
 *
 * Every movement runs inside the caller's transaction while holding the
 * `fees:{studentId}` advisory lock, and the balance is re-read under the lock,
 * so concurrent payments or generations can never spend the same credit twice
 * and the balance can never go below zero.
 */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (month) => `${MONTH_NAMES[Number(String(month).slice(5, 7)) - 1]} ${String(month).slice(0, 4)}`;
const currentMonthStamp = () => new Date().toISOString().slice(0, 7);

/** System actor for movements triggered by background generation. */
const systemActor = (schoolId) => ({ id: null, schoolId, role: "system", email: "system" });

async function lockStudent(studentId, transaction) {
  if (!transaction) throw new Error("credit movements need a transaction");
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", { replacements: { key: `fees:${studentId}` }, transaction });
}

async function balance(schoolId, studentId, { transaction } = {}) {
  const [[row]] = await sequelize.query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type = 'Credit' THEN amount ELSE -amount END), 0)::numeric(12,2) AS balance
     FROM student_credit_ledger WHERE fk_school_id = :schoolId AND fk_student_id = :studentId`,
    { replacements: { schoolId, studentId }, transaction },
  );
  return Number(row.balance);
}

/** Credit in. With a payment it records the excess of that payment. */
async function addCredit(actor, { studentId, amount, paymentId = null, source = "payment", notes = null }, { transaction } = {}) {
  const run = async (tx) => {
    await lockStudent(studentId, tx);
    const row = await StudentCreditLedger.create(
      { fkSchoolId: actor.schoolId, fkStudentId: studentId, entryType: "Credit", amount, source, fkPaymentId: paymentId, notes, fkCreatedByUserId: actor.id ?? null },
      { transaction: tx },
    );
    await auditService.record(actor, `credit in ${Number(amount).toFixed(2)} for student ${studentId}`, {
      entityType: "student_credit", entityId: row.id, metadata: { studentId, amount: Number(amount), paymentId, source, balanceAfter: await balance(actor.schoolId, studentId, { transaction: tx }) },
    }, { transaction: tx });
    return row;
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

/** Use credit against one fee month; refuses to take the balance below zero. */
async function applyCredit(actor, { studentId, amount, feeMonthId, paymentId = null }, { transaction } = {}) {
  const run = async (tx) => {
    await lockStudent(studentId, tx);
    const available = await balance(actor.schoolId, studentId, { transaction: tx });
    if (cents(amount) > cents(available)) throw new ApiError(422, `Only ${available.toFixed(2)} credit is available`);
    return StudentCreditLedger.create(
      { fkSchoolId: actor.schoolId, fkStudentId: studentId, entryType: "Applied", amount, source: "payment", fkFeeMonthId: feeMonthId, fkPaymentId: paymentId, fkCreatedByUserId: actor.id ?? null },
      { transaction: tx },
    );
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

/**
 * Spend the available credit on open bills, oldest month first (then oldest bill).
 * `feeMonthIds` limits it to those bills (newly generated ones). Each bill gets an
 * `Applied` row linked to it, its paid amount and status move, and one audit entry
 * covers the movement. Returns the lines applied.
 */
async function applyToOpenBills(actor, studentId, { transaction, feeMonthIds = null, paymentId = null, currentMonth = currentMonthStamp() } = {}) {
  await lockStudent(studentId, transaction);
  let available = cents(await balance(actor.schoolId, studentId, { transaction }));
  if (available <= 0) return [];
  const where = { fkStudentId: studentId, paidAmount: { [Op.lt]: col("net_amount") } };
  if (feeMonthIds) {
    if (!feeMonthIds.length) return [];
    where.id = feeMonthIds;
  }
  const bills = await StudentFeeMonths.findAll({ where, order: [["month", "ASC"], ["id", "ASC"]], lock: transaction.LOCK.UPDATE, transaction });
  const lines = [];
  for (const bill of bills) {
    if (available <= 0) break;
    const owed = cents(bill.getDataValue("netAmount")) - cents(bill.getDataValue("paidAmount"));
    const take = Math.min(owed, available);
    if (take <= 0) continue;
    await StudentCreditLedger.create(
      { fkSchoolId: actor.schoolId, fkStudentId: studentId, entryType: "Applied", amount: fromCents(take), source: "payment", fkFeeMonthId: bill.id, fkPaymentId: paymentId, fkCreatedByUserId: actor.id ?? null },
      { transaction },
    );
    const paid = fromCents(cents(bill.getDataValue("paidAmount")) + take);
    await bill.update({ paidAmount: paid, status: feeMonthStatus({ amountDue: bill.getDataValue("netAmount"), amountPaid: paid, month: bill.month }, currentMonth) }, { transaction });
    available -= take;
    lines.push({ feeMonthId: bill.id, month: bill.month, label: monthLabel(bill.month), feeType: bill.feeType, amount: fromCents(take) });
  }
  if (lines.length) {
    const total = fromCents(lines.reduce((n, l) => n + cents(l.amount), 0));
    await auditService.record(actor, `applied credit ${total.toFixed(2)} for student ${studentId} to ${lines.map((l) => l.label).join(", ")}`.slice(0, 100), {
      entityType: "student_credit", metadata: { studentId, paymentId, lines, balanceAfter: fromCents(available), trigger: paymentId ? "collection" : "generation" },
    }, { transaction });
  }
  return lines;
}

/** Every credit movement with a running balance, oldest first. */
async function history(schoolId, studentId, { transaction } = {}) {
  const rows = await StudentCreditLedger.findAll({
    where: { fkSchoolId: schoolId, fkStudentId: studentId },
    include: [
      { model: FeePayments, as: "payment", attributes: ["id", "receiptNo"], required: false },
      { model: StudentFeeMonths, as: "feeMonth", attributes: ["id", "month", "feeType"], required: false, paranoid: false },
    ],
    order: [["id", "ASC"]],
    transaction,
  });
  let running = 0;
  return rows.map((r) => {
    const amount = Number(r.amount);
    running += r.entryType === "Credit" ? cents(amount) : -cents(amount);
    return {
      id: r.id,
      date: r.get("created_at") || r.get("createdAt"),
      type: r.entryType,
      source: r.source,
      amount,
      balanceAfter: fromCents(running),
      receiptNo: r.payment ? r.payment.receiptNo : null,
      paymentId: r.fkPaymentId,
      feeMonth: r.feeMonth ? { id: r.feeMonth.id, month: r.feeMonth.month, label: monthLabel(r.feeMonth.month), feeType: r.feeMonth.feeType } : null,
      notes: r.notes,
    };
  });
}

module.exports = { balance, addCredit, applyCredit, applyToOpenBills, history, lockStudent, systemActor };
