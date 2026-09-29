"use strict";

const { DailyLessons, Classes, Subjects, Teachers, Users } = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { classId, date, subjectId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (date) where.date = date;
  if (subjectId) where.fkSubjectId = subjectId;
  return DailyLessons.findAll({
    where,
    include: [
      { model: Classes, as: "class" },
      { model: Subjects, as: "subject" },
      {
        model: Teachers,
        as: "teacher",
        include: [{ model: Users, as: "user", attributes: ["id", "firstName", "lastName"] }],
      },
    ],
    order: [["date", "DESC"], ["periodIndex", "ASC"]],
  });
}

async function create(schoolId, data) {
  return DailyLessons.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await DailyLessons.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Daily lesson not found");
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await DailyLessons.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Daily lesson not found");
  await row.destroy();
  return true;
}

module.exports = { list, create, update, remove };
