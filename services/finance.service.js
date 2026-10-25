"use strict";

/**
 * Finance (Step 8, Super Admin): income ledger (fee income derived from confirmed
 * fee payments + entered other income) and the financial report for a month,
 * FY quarter or financial year (Apr-Mar). Fee income is computed on every read,
 * never stored, from the same rows as the fee collection reports.
 */
const { Op } = require("sequelize");
const { OtherIncomes, Users, sequelize } = require("../models");
const { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, STAFF_EXPENSE_CATEGORY, FEE_INCOME } = require("../constants/finance");
const ApiError = require("../utils/ApiError");
const { today } = require("../utils/dates");
const { parsePeriod, currentPeriods, shortMonth } = require("../utils/finance_period");
const auditService = require("./audit.service");
const expenseService = require("./expense.service");
const L = require("./finance_ledger");

const incomeLabel = (key) => (key === FEE_INCOME.key ? FEE_INCOME.label : INCOME_CATEGORY_LABELS[key] || key);

function feeRow(p) {
  const student = L.fullName(p.first_name, p.last_name);
  return {
    id: `fee-${p.id}`,
    source: "fee",
    entryId: null,
    paymentId: p.id,
    category: FEE_INCOME.key,
    categoryLabel: FEE_INCOME.label,
    amount: Number(p.amount_paid),
    date: L.day(p.payment_date),
    description: `Fee collection — ${student}${p.class_label ? ` (${p.class_label})` : ""}`,
    detail: "Auto — from Fee Collection",
    reference: p.receipt_no || p.reference_no || null,
    receiptNo: p.receipt_no || null,
    paymentMethod: p.payment_method || null,
    period: p.period || null,
    locked: true,
  };
}

function otherRow(row) {
  const by = row.recordedBy;
  return {
    id: `oi-${row.id}`,
    source: "other",
    entryId: row.id,
    paymentId: null,
    category: row.categoryKey,
    categoryLabel: incomeLabel(row.categoryKey),
    originalCategory: row.category && row.category !== incomeLabel(row.categoryKey) ? row.category : null,
    amount: Number(row.amount),
    date: L.day(row.incomeDate),
    description: row.title,
    detail: row.receivedFrom ? `From ${row.receivedFrom}` : null,
    reference: row.referenceNo || null,
    receiptNo: null,
    paymentMethod: row.paymentMethod || null,
    receivedFrom: row.receivedFrom || null,
    notes: row.notes || null,
    recordedBy: by ? L.fullName(by.firstName, by.lastName) : null,
    locked: false,
  };
}

/** Income rows dated in [from, to): fee receipts + other income, oldest first. */
async function incomeEntries(schoolId, { from, to }) {
  const [fees, others] = await Promise.all([
    L.feePayments(schoolId, from, to),
    OtherIncomes.findAll({
      where: { fkSchoolId: schoolId, incomeDate: { [Op.gte]: from, [Op.lt]: to } },
      include: [{ model: Users, as: "recordedBy", attributes: ["firstName", "lastName"] }],
      order: [["incomeDate", "ASC"], ["id", "ASC"]],
    }),
  ]);
  return [...fees.map(feeRow), ...others.map(otherRow)].sort((a, b) => (a.date === b.date ? (a.source === b.source ? 0 : a.source === "fee" ? -1 : 1) : a.date < b.date ? -1 : 1));
}

function incomeTotals(rows) {
  const keys = [FEE_INCOME.key, ...INCOME_CATEGORIES];
  const byCategory = Object.fromEntries(keys.map((k) => [k, L.total(rows.filter((r) => r.category === k))]));
  const fee = byCategory[FEE_INCOME.key];
  const all = L.total(rows);
  return { total: all, fee, other: L.fromCents(L.cents(all) - L.cents(fee)), byCategory, receipts: rows.filter((r) => r.source === "fee").length, entries: rows.length };
}

/** GET /finance/income?period=YYYY-MM (default this month). */
async function incomeList(actor, { period } = {}) {
  const p = parsePeriod(period || currentPeriods().month);
  const rows = await incomeEntries(actor.schoolId, p);
  return { period: { key: p.key, kind: p.kind, label: p.label, from: p.from, to: p.to }, rows, totals: incomeTotals(rows) };
}

async function findIncome(actor, id) {
  const row = await OtherIncomes.findOne({ where: { id, fkSchoolId: actor.schoolId }, include: [{ model: Users, as: "recordedBy", attributes: ["firstName", "lastName"] }] });
  if (!row) throw new ApiError(404, "Income entry not found");
  return row;
}

const incomeFields = (data) => {
  const out = {};
  if (data.category !== undefined) {
    out.categoryKey = data.category;
    out.category = incomeLabel(data.category);
  }
  if (data.amount !== undefined) out.amount = data.amount;
  if (data.date !== undefined) out.incomeDate = data.date;
  if (data.description !== undefined) out.title = String(data.description).trim();
  if (data.referenceNo !== undefined) out.referenceNo = data.referenceNo ? String(data.referenceNo).trim() : null;
  if (data.receivedFrom !== undefined) out.receivedFrom = data.receivedFrom ? String(data.receivedFrom).trim() : null;
  if (data.paymentMethod !== undefined) out.paymentMethod = data.paymentMethod;
  if (data.notes !== undefined) out.notes = data.notes ? String(data.notes).trim() : null;
  return out;
};
const describeIncome = (row) => `income "${row.title}" (${incomeLabel(row.categoryKey)})`;
const incomeSnapshot = (row) => ({ category: row.categoryKey, amount: Number(row.amount), date: L.day(row.incomeDate), description: row.title, referenceNo: row.referenceNo || null });

async function createIncome(actor, data) {
  if (data.date > today()) throw new ApiError(400, "The income date can't be in the future.");
  const row = await sequelize.transaction(async (transaction) => {
    const created = await OtherIncomes.create({ paymentMethod: "Cash", ...incomeFields(data), fkSchoolId: actor.schoolId, fkRecordedByUserId: actor.id }, { transaction });
    await auditService.record(actor, `recorded ${describeIncome(created)}`.slice(0, 100), { entityType: "other_income", entityId: created.id, metadata: incomeSnapshot(created) }, { transaction });
    return created;
  });
  return otherRow(await findIncome(actor, row.id));
}

async function updateIncome(actor, id, data) {
  if (data.date && data.date > today()) throw new ApiError(400, "The income date can't be in the future.");
  const row = await findIncome(actor, id);
  await L.auditedUpdate(actor, row, incomeFields(data), { entityType: "other_income", describe: describeIncome });
  return otherRow(await findIncome(actor, id));
}

async function removeIncome(actor, id, { reason } = {}) {
  const row = await findIncome(actor, id);
  return L.auditedArchive(actor, row, reason, { entityType: "other_income", describe: describeIncome, snapshot: incomeSnapshot });
}

/** Category shares, largest first. `hideZero` drops categories with nothing in the period. */
function breakdown(keys, amounts, labelOf, { hideZero = false } = {}) {
  const whole = keys.reduce((s, k) => s + L.cents(amounts[k] || 0), 0);
  return keys
    .filter((key) => !hideZero || L.cents(amounts[key] || 0) !== 0)
    .map((key) => ({ key, label: labelOf(key), amount: amounts[key] || 0, percent: L.percent(L.cents(amounts[key] || 0), whole) }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * GET /finance/report?period=YYYY-MM | YYYY-Q1..Q4 | FY2026.
 * Totals for the period, a per-month series for the charts (the 6 months up to a
 * monthly period; every month of a quarter / FY), and the category breakdowns.
 */
async function report(actor, { period } = {}, { withEntries = false } = {}) {
  const p = parsePeriod(period || currentPeriods().month);
  const chartFrom = `${p.chartMonths[0]}-01`;
  const schoolId = actor.schoolId;
  const [fee, other, spent] = await Promise.all([
    L.feeIncomeByMonth(schoolId, chartFrom, p.to),
    L.enteredByMonth("other_incomes", "income_date", schoolId, chartFrom, p.to),
    L.enteredByMonth("expenses", "expense_date", schoolId, chartFrom, p.to),
  ]);
  const inPeriod = (m) => p.months.includes(m);
  const sumCents = (rows) => rows.reduce((s, r) => s + L.cents(r.amount), 0);

  const series = p.chartMonths.map((m) => {
    const feeC = L.cents(fee[m]?.amount);
    const otherC = sumCents(other.filter((r) => r.month === m));
    const expC = sumCents(spent.filter((r) => r.month === m));
    return { month: m, label: shortMonth(m), income: L.fromCents(feeC + otherC), feeIncome: L.fromCents(feeC), otherIncome: L.fromCents(otherC), expenses: L.fromCents(expC), net: L.fromCents(feeC + otherC - expC) };
  });

  const periodMonths = p.months;
  const feeC = periodMonths.reduce((s, m) => s + L.cents(fee[m]?.amount), 0);
  const receipts = periodMonths.reduce((s, m) => s + (fee[m]?.receipts || 0), 0);
  const otherIn = other.filter((r) => inPeriod(r.month));
  const spentIn = spent.filter((r) => inPeriod(r.month));
  const byIncome = { [FEE_INCOME.key]: L.fromCents(feeC) };
  for (const k of INCOME_CATEGORIES) byIncome[k] = L.fromCents(sumCents(otherIn.filter((r) => r.category === k)));
  const byExpense = Object.fromEntries(EXPENSE_CATEGORIES.map((k) => [k, L.fromCents(sumCents(spentIn.filter((r) => r.category === k)))]));
  const otherC = sumCents(otherIn);
  const expC = sumCents(spentIn);
  const net = feeC + otherC - expC;

  const result = {
    period: { key: p.key, kind: p.kind, label: p.label, from: p.from, to: p.to },
    totals: {
      income: L.fromCents(feeC + otherC),
      feeIncome: L.fromCents(feeC),
      otherIncome: L.fromCents(otherC),
      expenses: L.fromCents(expC),
      staffExpenses: byExpense[STAFF_EXPENSE_CATEGORY],
      net: L.fromCents(net),
      position: net > 0 ? "Surplus" : net < 0 ? "Deficit" : "Break-even",
    },
    series,
    breakdown: {
      income: breakdown([FEE_INCOME.key, ...INCOME_CATEGORIES], byIncome, incomeLabel),
      expenses: breakdown(EXPENSE_CATEGORIES, byExpense, (k) => EXPENSE_CATEGORY_LABELS[k], { hideZero: true }),
    },
    reconciliation: {
      feeReceipts: receipts,
      feeIncome: L.fromCents(feeC),
      otherIncomeEntries: otherIn.reduce((s, r) => s + r.entries, 0),
      expenseEntries: spentIn.reduce((s, r) => s + r.entries, 0),
      basis: "Fee income = confirmed fee payments (status Paid, not archived) by payment date, as in the fee collection reports.",
    },
    generatedAt: new Date().toISOString(),
  };
  if (withEntries) {
    const [income, expenses] = await Promise.all([incomeEntries(schoolId, p), expenseService.entries(actor, p)]);
    result.entries = { income, expenses };
  }
  return result;
}

module.exports = { incomeList, incomeEntries, incomeTotals, createIncome, updateIncome, removeIncome, report };
