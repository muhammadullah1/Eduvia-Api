"use strict";

const { Op } = require("sequelize");
const { TimetableSlots, Teachers, Users, Subjects, Classes } = require("../models");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");

/**
 * Timetable with clash protection (UR-03 depends on it): one slot per class
 * per weekday+period and one per teacher per weekday+period. The subject
 * defaults to the teacher's active subject and must match it (UR-02 / BR-02).
 */

async function listByClass(user, classId) {
  const where = { fkSchoolId: user.schoolId };
  if (classId) {
    await accessService.assertClassVisible(user, classId);
    where.fkClassId = classId;
  }
  return TimetableSlots.findAll({
    where,
    include: [
      { model: Subjects, as: "subject", attributes: ["id", "name"] },
      {
        model: Teachers,
        as: "teacher",
        attributes: ["id"],
        include: [{ model: Users, as: "user", attributes: ["firstName", "lastName", "email"] }],
      },
    ],
    order: [["day", "ASC"], ["periodIndex", "ASC"]],
  });
}

async function resolve(schoolId, data, excludeId) {
  const klass = await Classes.findOne({ where: { id: data.fkClassId, fkSchoolId: schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  if (data.periodIndex > klass.periodCount) {
    throw new ApiError(400, `${klass.label} only has ${klass.periodCount} periods.`);
  }
  const resolved = { ...data };
  if (data.fkTeacherId) {
    const teacher = await Teachers.findOne({
      where: { id: data.fkTeacherId, fkSchoolId: schoolId },
      include: [{ model: Users, as: "user", attributes: ["firstName", "lastName"] }],
    });
    if (!teacher) throw new ApiError(404, "Teacher not found");
    if (data.fkSubjectId && data.fkSubjectId !== teacher.fkSubjectId) {
      throw new ApiError(400, "This teacher is assigned a different subject; change the teacher's subject first.");
    }
    resolved.fkSubjectId = teacher.fkSubjectId;
    resolved.teacher = `${teacher.user.firstName} ${teacher.user.lastName}`;
  }
  if (resolved.fkSubjectId) {
    const subject = await Subjects.findOne({ where: { id: resolved.fkSubjectId, fkSchoolId: schoolId } });
    if (!subject) throw new ApiError(404, "Subject not found");
    resolved.subject = subject.name;
  }
  if (!resolved.subject) throw new ApiError(400, "A subject is required.");

  const idFilter = excludeId ? { id: { [Op.ne]: excludeId } } : {};
  const where = { fkSchoolId: schoolId, day: resolved.day, periodIndex: resolved.periodIndex, ...idFilter };
  if (await TimetableSlots.findOne({ where: { ...where, fkClassId: resolved.fkClassId } })) {
    throw new ApiError(409, `${klass.label} already has period ${resolved.periodIndex} on ${resolved.day}.`);
  }
  if (resolved.fkTeacherId && (await TimetableSlots.findOne({ where: { ...where, fkTeacherId: resolved.fkTeacherId } }))) {
    throw new ApiError(409, `${resolved.teacher} already teaches period ${resolved.periodIndex} on ${resolved.day}.`);
  }
  return resolved;
}

async function create(schoolId, data) {
  return TimetableSlots.create({ ...(await resolve(schoolId, data)), fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await TimetableSlots.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Timetable slot not found");
  const merged = {
    fkClassId: row.fkClassId,
    day: row.day,
    time: row.time,
    periodIndex: row.periodIndex,
    fkTeacherId: row.fkTeacherId,
    fkSubjectId: row.fkSubjectId,
    subject: row.subject,
    room: row.room,
    ...data,
  };
  await row.update(await resolve(schoolId, merged, row.id));
  return row;
}

async function remove(id, schoolId) {
  const row = await TimetableSlots.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Timetable slot not found");
  await row.destroy();
  return true;
}

module.exports = { listByClass, create, update, remove };
