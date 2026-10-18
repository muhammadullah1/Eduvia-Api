"use strict";

const { Op } = require("sequelize");
const { BlockDates } = require("../models");
const ApiError = require("../utils/ApiError");

const MAX_RANGE_DAYS = 31;

function parseDay(value) {
  const day = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new ApiError(400, "Enter a valid date.");
  }
  return day;
}

function dayCount(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function normalizeRange(payload) {
  const startDate = parseDay(payload.startDate ?? payload.start_date);
  const endDate = parseDay(payload.endDate ?? payload.end_date ?? startDate);
  if (endDate < startDate) {
    throw new ApiError(400, "End date cannot be before start date.");
  }
  if (dayCount(startDate, endDate) > MAX_RANGE_DAYS) {
    throw new ApiError(400, "A block date range cannot exceed one month.");
  }
  return {
    name: String(payload.name || "").trim(),
    startDate,
    endDate,
    dateType: startDate === endDate ? "single" : "multiple",
    description: payload.description ? String(payload.description).trim() : null,
  };
}

async function assertNoOverlap(schoolId, startDate, endDate, excludeId) {
  const where = {
    fkSchoolId: schoolId,
    startDate: { [Op.lte]: endDate },
    endDate: { [Op.gte]: startDate },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const clash = await BlockDates.findOne({ where });
  if (clash) {
    throw new ApiError(
      409,
      `These dates overlap "${clash.name}" (${clash.startDate} – ${clash.endDate}).`,
    );
  }
}

async function list(schoolId, { search, archived } = {}) {
  const where = { fkSchoolId: schoolId };
  if (search && String(search).trim()) {
    where.name = { [Op.iLike]: `%${String(search).trim()}%` };
  }
  if (archived) where.archived_at = { [Op.ne]: null };
  return BlockDates.findAll({
    where,
    paranoid: !archived,
    order: [["startDate", "DESC"], ["id", "DESC"]],
  });
}

async function create(schoolId, payload) {
  const values = normalizeRange(payload);
  if (!values.name) throw new ApiError(400, "Name is required.");
  const archivedDate = await BlockDates.findOne({
    where: { fkSchoolId: schoolId, name: { [Op.iLike]: values.name } },
    paranoid: false,
  });
  if (archivedDate && archivedDate.deletedAt) {
    throw new ApiError(
      409,
      `A block date named "${values.name}" is already in the archive. Restore it from Settings → Archives instead of creating a new one.`,
    );
  }
  await assertNoOverlap(schoolId, values.startDate, values.endDate);
  return BlockDates.create({ ...values, fkSchoolId: schoolId });
}

async function update(id, schoolId, payload) {
  const row = await BlockDates.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Block date not found");
  const values = normalizeRange({
    name: payload.name ?? row.name,
    startDate: payload.startDate ?? payload.start_date ?? row.startDate,
    endDate: payload.endDate ?? payload.end_date ?? row.endDate,
    description:
      payload.description !== undefined ? payload.description : row.description,
  });
  if (!values.name) throw new ApiError(400, "Name is required.");
  await assertNoOverlap(schoolId, values.startDate, values.endDate, row.id);
  await row.update(values);
  return row;
}

async function remove(id, schoolId) {
  const row = await BlockDates.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Block date not found");
  await row.destroy();
  return true;
}

async function restore(id, schoolId) {
  const row = await BlockDates.findOne({
    where: { id, fkSchoolId: schoolId },
    paranoid: false,
  });
  if (!row || !row.deletedAt) throw new ApiError(404, "Archived block date not found");
  await assertNoOverlap(schoolId, row.startDate, row.endDate, row.id);
  await row.restore();
  return row;
}

module.exports = { list, create, update, remove, restore };
