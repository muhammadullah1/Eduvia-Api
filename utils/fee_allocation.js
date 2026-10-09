"use strict";

const { FEE_MONTH_STATUS } = require("../constants");

const cents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => Math.round(value) / 100;

/** Status of a fee month given what has been paid and the current month. */
function feeMonthStatus({ amountDue, amountPaid, month }, currentMonthStart) {
  const due = cents(amountDue);
  const paid = cents(amountPaid);
  if (paid <= 0) return FEE_MONTH_STATUS.UNPAID;
  if (paid < due) return FEE_MONTH_STATUS.PARTIALLY_PAID;
  return month > currentMonthStart ? FEE_MONTH_STATUS.ADVANCE : FEE_MONTH_STATUS.PAID;
}

function outstanding(month) {
  return Math.max(0, cents(month.amountDue) - cents(month.amountPaid));
}

/**
 * Oldest-unpaid-first allocation (UR-09 / BR-12). Deterministic: months are
 * ordered by month then id, and each is cleared before the next is touched.
 * Returns the lines to write and whatever could not be placed.
 */
function planOldestFirst(months, amount) {
  let remaining = cents(amount);
  const lines = [];
  const ordered = [...months].sort((a, b) => String(a.month).localeCompare(String(b.month)) || a.id - b.id);
  for (const month of ordered) {
    if (remaining <= 0) break;
    const open = outstanding(month);
    if (open <= 0) continue;
    const take = Math.min(open, remaining);
    lines.push({ feeMonthId: month.id, amount: fromCents(take) });
    remaining -= take;
  }
  return { lines, leftover: fromCents(remaining) };
}

/**
 * Validates an explicit allocation recorded by an authorized user: every line
 * targets a known month, does not exceed that month's balance, and the lines
 * add up to no more than the payment.
 */
function validateManualPlan(months, amount, requested) {
  const byId = new Map(months.map((m) => [m.id, m]));
  let total = 0;
  const lines = [];
  for (const line of requested) {
    const month = byId.get(Number(line.feeMonthId));
    if (!month) return { error: `Fee month ${line.feeMonthId} does not belong to this student` };
    const value = cents(line.amount);
    if (value <= 0) return { error: "Allocation amounts must be positive" };
    if (value > outstanding(month)) return { error: `Allocation exceeds the balance of ${month.month}` };
    total += value;
    lines.push({ feeMonthId: month.id, amount: fromCents(value) });
  }
  if (total > cents(amount)) return { error: "Allocations exceed the payment amount" };
  return { lines, leftover: fromCents(cents(amount) - total) };
}

module.exports = { feeMonthStatus, planOldestFirst, validateManualPlan, outstanding: (m) => fromCents(outstanding(m)), cents, fromCents };
