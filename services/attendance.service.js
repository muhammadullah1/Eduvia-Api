"use strict";

const { Attendances, Students } = require("../models");
const ApiError = require("../utils/ApiError");

async function listByClassDate(schoolId, classId, date) {
  return Attendances.findAll({
    where: { fkClassId: classId, date },
    include: [
      {
        model: Students,
        as: "student",
        where: { fkSchoolId: schoolId },
        required: true,
      },
    ],
    order: [["id", "ASC"]],
  });
}

async function markMany(schoolId, { classId, date, marks }) {
  if (!Array.isArray(marks) || !marks.length) {
    throw new ApiError(400, "marks array is required");
  }
  const results = [];
  for (const m of marks) {
    const student = await Students.findOne({
      where: { id: m.studentId, fkSchoolId: schoolId },
    });
    if (!student) throw new ApiError(404, `Student ${m.studentId} not found`);

    const [row] = await Attendances.findOrCreate({
      where: { fkStudentId: m.studentId, date },
      defaults: {
        fkClassId: classId || student.fkClassId,
        status: m.status,
      },
    });
    if (row.status !== m.status || (classId && row.fkClassId !== classId)) {
      await row.update({
        status: m.status,
        fkClassId: classId || row.fkClassId,
      });
    }
    results.push(row);
  }
  return results;
}

module.exports = { listByClassDate, markMany };
