"use strict";

const {
  TeacherAbsences,
  Teachers,
  Classes,
  TimetableSlots,
  Users,
} = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { date, teacherId, classId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (date) where.date = date;
  if (teacherId) where.fkTeacherId = teacherId;
  if (classId) where.fkClassId = classId;
  return TeacherAbsences.findAll({
    where,
    include: [
      {
        model: Teachers,
        as: "teacher",
        include: [{ model: Users, as: "user", attributes: ["id", "firstName", "lastName"] }],
      },
      { model: Classes, as: "class" },
      { model: TimetableSlots, as: "slot" },
      {
        model: Teachers,
        as: "coverTeacher",
        include: [{ model: Users, as: "user", attributes: ["id", "firstName", "lastName"] }],
      },
    ],
    order: [["date", "DESC"], ["periodIndex", "ASC"]],
  });
}

async function create(schoolId, data) {
  return TeacherAbsences.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await TeacherAbsences.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Teacher absence not found");
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await TeacherAbsences.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Teacher absence not found");
  await row.destroy();
  return true;
}

module.exports = { list, create, update, remove };
