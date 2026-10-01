"use strict";

const {
  Teachers,
  Users,
  Subjects,
  Classes,
  TeacherClasses,
  TeacherSubjectAssignments,
  TimetableSlots,
  SubstituteAssignments,
  TeacherAbsences,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const accessService = require("./access.service");
const { today, weekdayOf, parse, iso } = require("../utils/dates");

const profileInclude = [
  { model: Users, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone", "status"] },
  { model: Subjects, as: "subject", attributes: ["id", "name", "code"] },
  { model: Classes, as: "classes", through: { attributes: [] }, attributes: ["id", "label", "grade", "section"] },
];

async function list(schoolId) {
  return Teachers.findAll({ where: { fkSchoolId: schoolId }, include: profileInclude, order: [["id", "ASC"]] });
}

async function getById(id, schoolId) {
  const row = await Teachers.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [
      ...profileInclude,
      {
        model: TeacherSubjectAssignments,
        as: "subjectHistory",
        include: [{ model: Subjects, as: "subject", attributes: ["id", "name", "code"] }],
      },
    ],
    order: [[{ model: TeacherSubjectAssignments, as: "subjectHistory" }, "effectiveFrom", "DESC"]],
  });
  if (!row) throw new ApiError(404, "Teacher not found");
  return row;
}

function dayBefore(date) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}

/**
 * Change a teacher's single active subject (UR-02 / BR-13). The previous
 * assignment is closed, a new one opened, and nothing historical is touched:
 * lessons, tests, marks and timetable rows keep their own subject id.
 */
async function changeSubject(actor, teacherId, { subjectId, reason, effectiveFrom }) {
  const teacher = await getById(teacherId, actor.schoolId);
  const subject = await Subjects.findOne({ where: { id: subjectId, fkSchoolId: actor.schoolId } });
  if (!subject) throw new ApiError(404, "Subject not found");
  if (teacher.fkSubjectId === subject.id) throw new ApiError(400, "Teacher already has this subject.");
  const from = effectiveFrom || today();

  await sequelize.transaction(async (transaction) => {
    const active = await TeacherSubjectAssignments.findOne({
      where: { fkTeacherId: teacher.id, effectiveTo: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (active) {
      if (active.effectiveFrom > from) throw new ApiError(400, "Effective date is before the current assignment.");
      await active.update({ effectiveTo: active.effectiveFrom === from ? from : dayBefore(from) }, { transaction });
    }
    await TeacherSubjectAssignments.create(
      {
        fkSchoolId: actor.schoolId,
        fkTeacherId: teacher.id,
        fkSubjectId: subject.id,
        effectiveFrom: from,
        fkAssignedByUserId: actor.id,
        reason: reason || null,
      },
      { transaction },
    );
    await teacher.update({ fkSubjectId: subject.id }, { transaction });
    await auditService.record(
      actor,
      `changed teacher #${teacher.id} subject to ${subject.name}`,
      {
        entityType: "teacher",
        entityId: teacher.id,
        metadata: { fromSubjectId: active ? active.fkSubjectId : null, toSubjectId: subject.id, effectiveFrom: from, reason },
      },
      { transaction },
    );
  });
  return getById(teacherId, actor.schoolId);
}

async function assignClasses(actor, teacherId, classIds = []) {
  const teacher = await getById(teacherId, actor.schoolId);
  await sequelize.transaction(async (transaction) => {
    await TeacherClasses.destroy({ where: { fkTeacherId: teacher.id }, transaction });
    if (classIds.length) {
      await TeacherClasses.bulkCreate(classIds.map((fkClassId) => ({ fkTeacherId: teacher.id, fkClassId })), { transaction });
    }
  });
  return getById(teacherId, actor.schoolId);
}

/**
 * The teacher's day (UR-03): regular periods for that weekday, flagged when
 * the teacher is marked absent, plus any classes they are covering.
 */
async function scheduleFor(teacher, date) {
  const weekday = weekdayOf(date);
  const [slots, absences, covers] = await Promise.all([
    TimetableSlots.findAll({
      where: { fkTeacherId: teacher.id, day: weekday },
      include: [{ model: Classes, as: "class", attributes: ["id", "label"] }],
      order: [["periodIndex", "ASC"]],
    }),
    TeacherAbsences.findAll({
      where: { fkTeacherId: teacher.id, date },
      include: [{ model: SubstituteAssignments, as: "substitution" }],
    }),
    SubstituteAssignments.findAll({
      where: { fkSubstituteTeacherId: teacher.id, date },
      include: [
        { model: Classes, as: "class", attributes: ["id", "label"] },
        { model: Subjects, as: "subject", attributes: ["id", "name"] },
        { model: Teachers, as: "originalTeacher", include: [{ model: Users, as: "user", attributes: ["firstName", "lastName"] }] },
      ],
    }),
  ]);
  const absentPeriods = new Map(absences.map((a) => [a.periodIndex, a]));
  const periods = [
    ...slots.map((slot) => ({
      kind: "regular",
      periodIndex: slot.periodIndex,
      time: slot.time,
      class: slot.class,
      subject: slot.subject,
      room: slot.room,
      absent: absentPeriods.has(slot.periodIndex),
    })),
    ...covers.map((cover) => ({
      kind: "substitute",
      periodIndex: cover.periodIndex,
      class: cover.class,
      subject: cover.subject ? cover.subject.name : null,
      coveringFor: cover.originalTeacher && cover.originalTeacher.user
        ? `${cover.originalTeacher.user.firstName} ${cover.originalTeacher.user.lastName}`
        : null,
      substitutionId: cover.id,
    })),
  ].sort((a, b) => a.periodIndex - b.periodIndex);
  return { date, weekday, teacherId: teacher.id, subjectId: teacher.fkSubjectId, periods };
}

async function mySchedule(user, date) {
  const teacher = await accessService.teacherFor(user);
  return scheduleFor(teacher, date || today());
}

module.exports = { list, getById, changeSubject, assignClasses, scheduleFor, mySchedule };
