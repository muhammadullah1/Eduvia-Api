"use strict";

const { Subjects } = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId) {
  return Subjects.findAll({ where: { fkSchoolId: schoolId }, order: [["name", "ASC"]] });
}

async function getById(id, schoolId) {
  const row = await Subjects.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Subject not found");
  return row;
}

async function create(schoolId, data) {
  return Subjects.create({ ...data, fkSchoolId: schoolId });
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
