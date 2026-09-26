"use strict";

const { MarkSheets, MarkSheetRows, Students, sequelize } = require("../models");
const { SHEET_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { classId, status } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (status) where.status = status;
  return MarkSheets.findAll({
    where,
    include: [{ model: MarkSheetRows, as: "rows" }],
    order: [["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await MarkSheets.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: MarkSheetRows, as: "rows" }],
  });
  if (!row) throw new ApiError(404, "Mark sheet not found");
  return row;
}

async function create(schoolId, data) {
  const { rows = [], ...rest } = data;
  return sequelize.transaction(async (t) => {
    const sheet = await MarkSheets.create(
      { ...rest, fkSchoolId: schoolId, status: SHEET_STATUS.DRAFT },
      { transaction: t },
    );
    if (rows.length) {
      await MarkSheetRows.bulkCreate(
        rows.map((r) => ({
          fkMarkSheetId: sheet.id,
          fkStudentId: r.studentId || r.fkStudentId,
          score: r.score ?? null,
        })),
        { transaction: t },
      );
    }
    return getById(sheet.id, schoolId);
  });
}

async function updateRows(id, schoolId, rows) {
  const sheet = await getById(id, schoolId);
  if (sheet.status === SHEET_STATUS.PUBLISHED) {
    throw new ApiError(400, "Cannot edit a published mark sheet");
  }
  return sequelize.transaction(async (t) => {
    for (const r of rows) {
      const studentId = r.studentId || r.fkStudentId;
      const [row] = await MarkSheetRows.findOrCreate({
        where: { fkMarkSheetId: id, fkStudentId: studentId },
        defaults: { score: r.score ?? null },
        transaction: t,
      });
      await row.update({ score: r.score ?? null }, { transaction: t });
    }
    return getById(id, schoolId);
  });
}

async function setStatus(id, schoolId, status) {
  const allowed = Object.values(SHEET_STATUS);
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid sheet status");
  const sheet = await getById(id, schoolId);
  await sheet.update({ status });
  return getById(id, schoolId);
}

module.exports = { list, getById, create, updateRows, setStatus };
