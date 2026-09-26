"use strict";

const { Classes } = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { sessionId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (sessionId) where.fkSessionId = sessionId;
  return Classes.findAll({ where, order: [["grade", "ASC"], ["section", "ASC"]] });
}

async function getById(id, schoolId) {
  const row = await Classes.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Class not found");
  return row;
}

async function create(schoolId, data) {
  return Classes.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove };
