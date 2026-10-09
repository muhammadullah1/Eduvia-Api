"use strict";

const { Attendances, Students } = require("../models");
const ApiError = require("../utils/ApiError");

async function listByClassDate(schoolId, classId, date, studentIds) {
  const where = {};
  if (classId) where.fkClassId = classId;
  if (date) where.date = date;
  if (studentIds) where.fkStudentId = studentIds;
  return Attendances.findAll({
    where,
    include: [
      {
        model: Students,
        as: "student",
        where: { fkSchoolId: schoolId },
        required: true,
      },
    ],
    order: [["date", "DESC"], ["id", "ASC"]],
    limit: 500,
  });
}

function storedStatus(status) {
  if (status === "Leave") return "Excused";
  return status;
}

async function markMany(schoolId, { classId, date, marks }) {
  if (!Array.isArray(marks) || !marks.length) {
    throw new ApiError(400, "marks array is required");
  }
  const results = [];
  for (const m of marks) {
    const student = await Students.findOne({
      where: { id: m.studentId, fkSchoolId: schoolId, ...(classId && { fkClassId: classId }) },
    });
    if (!student) throw new ApiError(404, `Student ${m.studentId} not found`);

    const [row] = await Attendances.findOrCreate({
      where: { fkStudentId: m.studentId, date },
      defaults: {
        fkSchoolId: schoolId,
        fkClassId: classId || student.fkClassId,
        status: storedStatus(m.status),
      },
    });
    const nextStatus = storedStatus(m.status);
    if (row.status !== nextStatus || (classId && row.fkClassId !== classId)) {
      await row.update({
        status: nextStatus,
        fkClassId: classId || row.fkClassId,
      });
    }
    results.push(row);
  }
  return results;
}

module.exports = { listByClassDate, markMany };
