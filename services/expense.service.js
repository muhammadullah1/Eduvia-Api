"use strict";

/**
 * Expenses (Finance Step 8). Super Admin records, edits and deletes (soft, with a
 * reason) and sees the totals. The accountant may record expenses and list the
 * ones they recorded themselves: no totals, no school-wide figures (BR-11).
 */
const { Op } = require("sequelize");
const { Expenses, Users, sequelize } = require("../models");
const { USER_ROLES } = require("../constants");
const { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, STAFF_EXPENSE_CATEGORY } = require("../constants/finance");
const ApiError = require("../utils/ApiError");
const { addMonths, today } = require("../utils/dates");
const auditService = require("./audit.service");
const { total, day, fullName, auditedUpdate, auditedArchive } = require("./finance_ledger");

const isOwnOnly = (actor) => actor.role === USER_ROLES.ACCOUNTANT;
const label = (key) => EXPENSE_CATEGORY_LABELS[key] || key;

function present(row) {
  const by = row.recordedBy;
  return {
    id: row.id,
    category: row.categoryKey,
    categoryLabel: label(row.categoryKey),
    /** Free-text category of an entry recorded before Step 8, when it differs from the mapped label. */
    originalCategory: row.category && row.category !== label(row.categoryKey) ? row.category : null,
    amount: Number(row.amount),
    date: day(row.expenseDate),
    description: row.title,
    referenceNo: row.referenceNo || null,
    paymentMethod: row.paymentMethod || null,
    notes: row.notes || null,
    recordedBy: by ? fullName(by.firstName, by.lastName) : null,
    recordedById: row.fkRecordedByUserId,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/** Rows (and, for the Super Admin, totals) for entries dated in [from, to). */
async function entries(actor, { from, to }) {
  const where = { fkSchoolId: actor.schoolId, expenseDate: { [Op.gte]: from, [Op.lt]: to } };
  if (isOwnOnly(actor)) where.fkRecordedByUserId = actor.id;
  const rows = await Expenses.findAll({
    where,
    include: [{ model: Users, as: "recordedBy", attributes: ["firstName", "lastName"] }],
    order: [["expenseDate", "ASC"], ["id", "ASC"]],
  });
  return rows.map(present);
}

function totals(rows) {
  const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((key) => [key, total(rows.filter((r) => r.category === key))]));
  const all = total(rows);
  const staff = byCategory[STAFF_EXPENSE_CATEGORY];
  return { total: all, staff, other: Math.round((all - staff) * 100) / 100, byCategory, entries: rows.length };
}

/** GET /expenses?month=YYYY-MM (default this month). */
async function list(actor, { month } = {}) {
  const target = month || today().slice(0, 7);
  const from = `${target}-01`;
  const rows = await entries(actor, { from, to: addMonths(from, 1) });
  if (isOwnOnly(actor)) return { month: target, scope: "own", rows };
  return { month: target, scope: "school", rows, totals: totals(rows) };
}

async function find(actor, id) {
  const where = { id, fkSchoolId: actor.schoolId };
  if (isOwnOnly(actor)) where.fkRecordedByUserId = actor.id;
  const row = await Expenses.findOne({ where, include: [{ model: Users, as: "recordedBy", attributes: ["firstName", "lastName"] }] });
  if (!row) throw new ApiError(404, "Expense not found");
  return row;
}

async function getById(actor, id) {
  return present(await find(actor, id));
}

const fields = (data) => {
  const out = {};
  if (data.category !== undefined) {
    out.categoryKey = data.category;
    out.category = label(data.category);
  }
  if (data.amount !== undefined) out.amount = data.amount;
  if (data.date !== undefined) out.expenseDate = data.date;
  if (data.description !== undefined) out.title = String(data.description).trim();
  if (data.referenceNo !== undefined) out.referenceNo = data.referenceNo ? String(data.referenceNo).trim() : null;
  if (data.paymentMethod !== undefined) out.paymentMethod = data.paymentMethod || null;
  if (data.notes !== undefined) out.notes = data.notes ? String(data.notes).trim() : null;
  return out;
};

const describe = (row) => `expense "${row.title}" (${label(row.categoryKey)})`;
const snapshot = (row) => ({ category: row.categoryKey, amount: Number(row.amount), date: day(row.expenseDate), description: row.title, referenceNo: row.referenceNo || null });

async function create(actor, data) {
  if (data.date > today()) throw new ApiError(400, "The expense date can't be in the future.");
  const row = await sequelize.transaction(async (transaction) => {
    const created = await Expenses.create({ ...fields(data), fkSchoolId: actor.schoolId, fkRecordedByUserId: actor.id }, { transaction });
    await auditService.record(actor, `recorded ${describe(created)}`.slice(0, 100), { entityType: "expense", entityId: created.id, metadata: snapshot(created) }, { transaction });
    return created;
  });
  return getById(actor, row.id);
}

async function update(actor, id, data) {
  if (data.date && data.date > today()) throw new ApiError(400, "The expense date can't be in the future.");
  const row = await find(actor, id);
  await auditedUpdate(actor, row, fields(data), { entityType: "expense", describe });
  return getById(actor, id);
}

async function remove(actor, id, { reason } = {}) {
  const row = await find(actor, id);
  return auditedArchive(actor, row, reason, { entityType: "expense", describe, snapshot });
}

module.exports = { list, entries, totals, getById, create, update, remove, present };
