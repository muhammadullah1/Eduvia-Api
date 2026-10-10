"use strict";

const { Attendances, Students } = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

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

async function markMany(schoolId, { classId, date, marks }, actor) {
  if (!Array.isArray(marks) || !marks.length) {
    throw new ApiError(400, "marks array is required");
  }
  const results = [];
  for (const m of marks) {
    const student = await Students.findOne({
      where: { id: m.studentId, fkSchoolId: schoolId, ...(classId && { fkClassId: classId }) },
    });
    if (!student) throw new ApiError(404, `Student ${m.studentId} not found`);

    const [row, created] = await Attendances.findOrCreate({
      where: { fkStudentId: m.studentId, date },
      defaults: {
        fkSchoolId: schoolId,
        fkClassId: classId || student.fkClassId,
        status: m.status,
        fkMarkedByUserId: actor ? actor.id : null,
      },
    });
    const previous = row.status;
    if (!created && (row.status !== m.status || (classId && row.fkClassId !== classId) || row.fkSchoolId !== schoolId)) {
      await row.update({
        status: m.status,
        fkClassId: classId || row.fkClassId,
        fkSchoolId: schoolId,
        fkMarkedByUserId: actor ? actor.id : row.fkMarkedByUserId,
      });
      if (actor && previous !== m.status) {
        await auditService.record(actor, `changed attendance for student #${student.id} on ${date}`, {
          entityType: "attendance",
          entityId: row.id,
          metadata: { studentId: student.id, date, from: previous, to: m.status },
        });
      }
    }
    results.push(row);
  }
  return results;
}

module.exports = { listByClassDate, markMany };
