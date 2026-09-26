"use strict";

const { TimetableSlots } = require("../models");
const ApiError = require("../utils/ApiError");

async function listByClass(schoolId, classId) {
  return TimetableSlots.findAll({
    where: { fkSchoolId: schoolId, fkClassId: classId },
    order: [["day", "ASC"], ["time", "ASC"]],
  });
}

async function create(schoolId, data) {
  return TimetableSlots.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await TimetableSlots.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Timetable slot not found");
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await TimetableSlots.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Timetable slot not found");
  await row.destroy();
  return true;
}

module.exports = { listByClass, create, update, remove };
