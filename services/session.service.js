"use strict";

const { AcademicSessions, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId) {
  return AcademicSessions.findAll({
    where: { fkSchoolId: schoolId },
    order: [["startDate", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await AcademicSessions.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Session not found");
  return row;
}

async function create(schoolId, data) {
  return AcademicSessions.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  await row.update(data);
  return row;
}

async function activate(id, schoolId) {
  return sequelize.transaction(async (t) => {
    await AcademicSessions.update(
      { isCurrent: false },
      { where: { fkSchoolId: schoolId }, transaction: t },
    );
    const row = await AcademicSessions.findOne({
      where: { id, fkSchoolId: schoolId },
      transaction: t,
    });
    if (!row) throw new ApiError(404, "Session not found");
    await row.update({ isCurrent: true }, { transaction: t });
    return row;
  });
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, activate, remove };
