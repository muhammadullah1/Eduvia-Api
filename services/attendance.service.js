"use strict";

const { Attendances, AttendanceChanges, Students } = require("../models");
const { SETTING_KEYS, USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const { assertEditable } = require("./attendance_review.service");

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
  let windowDays = null;
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
    const changed = !created && previous !== m.status;
    // SRS 6.3: a teacher may change saved marks only inside the school's edit window.
    if (changed && actor && actor.role === USER_ROLES.TEACHER) {
      if (windowDays === null) {
        windowDays = (await settingsService.get(schoolId, SETTING_KEYS.ATTENDANCE)).editWindowDays;
      }
      assertEditable(date, windowDays);
    }
    if (!created && (row.status !== m.status || (classId && row.fkClassId !== classId) || row.fkSchoolId !== schoolId)) {
      await row.update({
        status: m.status,
        fkClassId: classId || row.fkClassId,
        fkSchoolId: schoolId,
        fkMarkedByUserId: actor ? actor.id : row.fkMarkedByUserId,
      });
      if (previous !== m.status) {
        await AttendanceChanges.create({
          fkSchoolId: schoolId,
          fkAttendanceId: row.id,
          fkStudentId: student.id,
          fkClassId: classId || row.fkClassId,
          date,
          fromStatus: previous,
          toStatus: m.status,
          reason: null,
          source: "register",
          fkActorUserId: actor ? actor.id : null,
        });
      }
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
