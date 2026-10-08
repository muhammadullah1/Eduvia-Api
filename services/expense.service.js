"use strict";

const { Expenses } = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

async function list(schoolId, { category, date, limit = 100, offset = 0 } = {}) {
  const where = { fkSchoolId: schoolId };
  if (category) where.category = category;
  if (date) where.expenseDate = date;
  return Expenses.findAll({
    where,
    order: [["expenseDate", "DESC"], ["id", "DESC"]],
    limit: Math.min(Number(limit) || 100, 200),
    offset: Math.max(Number(offset) || 0, 0),
  });
}

async function getById(id, schoolId) {
  const row = await Expenses.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Expense not found");
  return row;
}

async function create(actor, data) {
  const row = await Expenses.create({
    fkSchoolId: actor.schoolId,
    title: data.title,
    category: data.category || null,
    amount: data.amount,
    date: data.date,
  });
  await auditService.record(actor, `recorded expense "${row.title}" (${row.amount})`, {
    entityType: "expense",
    entityId: row.id,
    metadata: { title: row.title, category: row.category, amount: row.amount, date: row.date },
  });
  return row;
}

async function update(actor, id, data) {
  const row = await getById(id, actor.schoolId);
  await row.update(data);
  await auditService.record(actor, `updated expense "${row.title}"`, {
    entityType: "expense",
    entityId: row.id,
    metadata: data,
  });
  return row;
}

async function remove(actor, id) {
  const row = await getById(id, actor.schoolId);
  await row.destroy();
  await auditService.record(actor, `deleted expense "${row.title}"`, {
    entityType: "expense",
    entityId: id,
  });
  return true;
}

module.exports = { list, getById, create, update, remove };
