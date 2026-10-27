"use strict";

/**
 * Shared finance building blocks (Step 8): money in cents, the one definition of
 * fee income, and audited edit / soft delete for the entered entries.
 *
 * Fee income is never stored or typed in: it is the sum of confirmed fee
 * payments (`fee_payments.status = 'Paid'`, not archived) by payment date, the
 * same rows the fee collection reports read (fee_report.service paymentRows /
 * monthly). Other income and expenses are the entered rows that are not
 * soft-deleted (`archived_at IS NULL`).
 */
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

const cents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => Math.round(value) / 100;
/** Sum of `key` over rows, exact to the paisa. */
const total = (rows, key = "amount") => fromCents(rows.reduce((s, r) => s + cents(r[key]), 0));
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const day = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10));
const fullName = (first, last) => [first, last].filter(Boolean).join(" ").trim();

const query = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** Confirmed fee receipts of the school; the WHERE every finance figure reconciles on. */
const FEE_INCOME_WHERE = `p.fk_school_id = :schoolId AND p.archived_at IS NULL AND p.status = 'Paid'`;

/** Fee receipts with payment date in [from, to). */
function feePayments(schoolId, from, to) {
  return query(
    `SELECT p.id, p.payment_date, p.receipt_no, p.reference_no, p.payment_method, p.amount_paid, p.period,
            s.first_name, s.last_name, s.admission_no, c.label AS class_label
       FROM fee_payments p
       JOIN students s ON s.id = p.fk_student_id
       LEFT JOIN classes c ON c.id = s.fk_class_id
      WHERE ${FEE_INCOME_WHERE} AND p.payment_date >= :from AND p.payment_date < :to
      ORDER BY p.payment_date, p.id`,
    { schoolId, from, to },
  );
}

/** Fee income per month (YYYY-MM) in [from, to): { month: { amount, receipts } }. */
async function feeIncomeByMonth(schoolId, from, to) {
  const rows = await query(
    `SELECT to_char(p.payment_date, 'YYYY-MM') AS month, COALESCE(SUM(p.amount_paid), 0) AS amount, COUNT(*)::int AS receipts
       FROM fee_payments p
      WHERE ${FEE_INCOME_WHERE} AND p.payment_date >= :from AND p.payment_date < :to
      GROUP BY 1`,
    { schoolId, from, to },
  );
  return Object.fromEntries(rows.map((r) => [r.month, { amount: Number(r.amount), receipts: r.receipts }]));
}

/** Entered rows per (month, category_key) in [from, to) for `table` ("expenses" | "other_incomes"). */
async function enteredByMonth(table, dateColumn, schoolId, from, to) {
  const rows = await query(
    `SELECT to_char(${dateColumn}, 'YYYY-MM') AS month, category_key AS category, COALESCE(SUM(amount), 0) AS amount, COUNT(*)::int AS entries
       FROM ${table}
      WHERE fk_school_id = :schoolId AND archived_at IS NULL AND ${dateColumn} >= :from AND ${dateColumn} < :to
      GROUP BY 1, 2`,
    { schoolId, from, to },
  );
  return rows.map((r) => ({ month: r.month, category: r.category, amount: Number(r.amount), entries: r.entries }));
}

/** Field-by-field before/after for the audit trail (only fields that changed). */
function diff(row, patch) {
  const changes = {};
  for (const [key, next] of Object.entries(patch)) {
    const prev = row.get(key);
    const a = prev == null ? null : String(prev);
    const b = next == null ? null : String(next);
    if (key === "amount" ? cents(prev) !== cents(next) : a !== b) changes[key] = { from: prev ?? null, to: next ?? null };
  }
  return changes;
}

/** Audited update: applies `patch`, records only the changed fields. */
async function auditedUpdate(actor, row, patch, { entityType, describe }) {
  const changes = diff(row, patch);
  if (!Object.keys(changes).length) return { row, changed: false };
  await sequelize.transaction(async (transaction) => {
    await row.update(patch, { transaction });
    await auditService.record(actor, `updated ${describe(row)}`.slice(0, 100), { entityType, entityId: row.id, metadata: { changes } }, { transaction });
  });
  return { row, changed: true };
}

/** Audited soft delete: keeps the row (archived_at), with the reason and who did it. */
async function auditedArchive(actor, row, reason, { entityType, describe, snapshot }) {
  const why = String(reason || "").trim();
  if (why.length < 3) throw new ApiError(400, "Give a reason (at least 3 characters) for deleting this entry.");
  await sequelize.transaction(async (transaction) => {
    await row.update({ archiveReason: why, fkArchivedByUserId: actor.id }, { transaction });
    await row.destroy({ transaction });
    await auditService.record(actor, `deleted ${describe(row)}`.slice(0, 100), { entityType, entityId: row.id, metadata: { reason: why, entry: snapshot(row) } }, { transaction });
  });
  return true;
}

module.exports = { cents, fromCents, total, percent, day, fullName, query, FEE_INCOME_WHERE, feePayments, feeIncomeByMonth, enteredByMonth, diff, auditedUpdate, auditedArchive };
