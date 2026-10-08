"use strict";

const { Op } = require("sequelize");
const {
  TeacherAbsences,
  SubstituteAssignments,
  TimetableSlots,
  Teachers,
  Users,
  Classes,
  Subjects,
  sequelize,
} = require("../models");
const { ABSENCE_STATUS, USER_ROLES } = require("../constants");
const accessService = require("./access.service");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { weekdayOf } = require("../utils/dates");
const { busyTeacherIds } = require("../utils/substitutes");

const teacherWithName = (as) => ({
  model: Teachers,
  as,
  attributes: ["id", "fkSubjectId"],
  include: [{ model: Users, as: "user", attributes: ["firstName", "lastName"] }],
});

const absenceInclude = [
  teacherWithName("teacher"),
  {
    model: SubstituteAssignments,
    as: "substitutions",
    include: [
      teacherWithName("substituteTeacher"),
      {
        model: TimetableSlots,
        as: "slot",
        include: [
          { model: Classes, as: "class", attributes: ["id", "label"] },
          { model: Subjects, as: "subject", attributes: ["id", "name"] },
        ],
      },
    ],
  },
];

const teacherName = (t) => (t && t.user ? `${t.user.firstName} ${t.user.lastName}` : `Teacher #${t && t.id}`);

async function list(schoolId, { date, teacherId, status } = {}, user) {
  const where = { fkSchoolId: schoolId };
  if (date) where.date = date;
  if (teacherId) where.fkTeacherId = teacherId;
  if (status) where.status = status;
  const rows = await TeacherAbsences.findAll({ where, include: absenceInclude, order: [["date", "DESC"], ["id", "ASC"]] });
  if (!user || user.role !== USER_ROLES.TEACHER) return rows;
  const teacher = await accessService.teacherFor(user);
  return rows.filter((row) => row.fkTeacherId === teacher.id || (row.substitutions || []).some((item) => item.fkSubstituteTeacherId === teacher.id));
}

async function getById(id, schoolId, options = {}) {
  const row = await TeacherAbsences.findOne({ where: { id, fkSchoolId: schoolId }, include: absenceInclude, ...options });
  if (!row) throw new ApiError(404, "Absence not found");
  return row;
}

/**
 * Mark a teacher absent for specific periods or the whole day (UR-03 §5.1).
 * Each period is linked to the class the timetable says they teach then;
 * periods without a class are recorded as NoClass (nothing to cover).
 */
async function markAbsent(actor, { teacherId, date, periods, fullDay, notes }) {
  const teacher = await Teachers.findOne({ where: { id: teacherId, fkSchoolId: actor.schoolId } });
  if (!teacher) throw new ApiError(404, "Teacher not found");
  const weekday = weekdayOf(date);
  const slots = await TimetableSlots.findAll({ where: { fkSchoolId: actor.schoolId, fkTeacherId: teacher.id, day: weekday } });
  const slotByPeriod = new Map(slots.map((s) => [s.periodIndex, s]));
  const targetPeriods = fullDay ? slots.map((s) => s.periodIndex) : [...new Set(periods || [])];
  if (!targetPeriods.length) throw new ApiError(400, "No periods to mark: the teacher has no classes that day.");

  const ids = await sequelize.transaction(async (transaction) => {
    const out = [];
    for (const periodIndex of targetPeriods.sort((a, b) => a - b)) {
      const slot = slotByPeriod.get(periodIndex);
      const values = {
        fkClassId: slot ? slot.fkClassId : null,
        fkSubjectId: slot ? slot.fkSubjectId : null,
        fkTimetableSlotId: slot ? slot.id : null,
        status: slot ? ABSENCE_STATUS.PENDING : ABSENCE_STATUS.NO_CLASS,
        fkMarkedByUserId: actor.id,
        notes: notes || null,
      };
      const existing = await TeacherAbsences.findOne({ where: { fkTeacherId: teacher.id, date, periodIndex }, transaction });
      if (existing && existing.status !== ABSENCE_STATUS.CANCELLED) {
        out.push(existing.id);
        continue;
      }
      const row = existing
        ? await existing.update(values, { transaction })
        : await TeacherAbsences.create({ ...values, fkSchoolId: actor.schoolId, fkTeacherId: teacher.id, date, periodIndex }, { transaction });
      out.push(row.id);
    }
    await auditService.record(
      actor,
      `marked teacher #${teacher.id} absent on ${date} (periods ${targetPeriods.join(", ")})`,
      { entityType: "teacher", entityId: teacher.id, metadata: { date, periods: targetPeriods } },
      { transaction },
    );
    return out;
  });
  return TeacherAbsences.findAll({ where: { id: ids }, include: absenceInclude, order: [["periodIndex", "ASC"]] });
}

async function busyAt(schoolId, date, periodIndex, transaction) {
  const [slots, substitutions, absences] = await Promise.all([
    TimetableSlots.findAll({ where: { fkSchoolId: schoolId, day: weekdayOf(date), periodIndex }, attributes: ["fkTeacherId"], transaction }),
    SubstituteAssignments.findAll({ where: { fkSchoolId: schoolId, date, periodIndex }, attributes: ["fkSubstituteTeacherId"], transaction }),
    TeacherAbsences.findAll({
      where: { fkSchoolId: schoolId, date, periodIndex, status: { [Op.ne]: ABSENCE_STATUS.CANCELLED } },
      attributes: ["fkTeacherId"],
      transaction,
    }),
  ]);
  return busyTeacherIds({ slots, substitutions, absences });
}

/**
 * Teachers free at the absence's exact weekday + period (§5.2): no timetable
 * slot then, not already substituting, not absent themselves. Same-subject
 * teachers are listed first; the manager still picks (§5.3).
 */
async function availableSubstitutes(schoolId, absenceId) {
  const absence = await getById(absenceId, schoolId);
  if (!absence.fkClassId) return { absence, teachers: [] };
  const busy = await busyAt(schoolId, absence.date, absence.periodIndex);
  const current = absence.substitution ? absence.substitution.fkSubstituteTeacherId : null;
  const teachers = await Teachers.findAll({
    where: { fkSchoolId: schoolId, id: { [Op.ne]: absence.fkTeacherId } },
    include: [
      { model: Users, as: "user", attributes: ["firstName", "lastName"] },
      { model: Subjects, as: "subject", attributes: ["id", "name"] },
    ],
  });
  const free = teachers
    .filter((t) => !busy.has(t.id) || t.id === current)
    .map((t) => ({
      id: t.id,
      name: teacherName(t),
      subject: t.subject,
      sameSubject: t.fkSubjectId === absence.fkSubjectId,
      current: t.id === current,
    }))
    .sort((a, b) => Number(b.sameSubject) - Number(a.sameSubject) || a.name.localeCompare(b.name));
  return { absence, teachers: free };
}

/**
 * Assign the picked substitute (§5.4). Runs in a transaction that serialises
 * on date+period and re-checks availability, so two managers cannot give the
 * same teacher two classes at once; a busy teacher is rejected with 409.
 */
async function assignSubstitute(actor, absenceId, { substituteTeacherId, notes }) {
  await sequelize.transaction(async (transaction) => {
    const absence = await TeacherAbsences.findOne({
      where: { id: absenceId, fkSchoolId: actor.schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!absence) throw new ApiError(404, "Absence not found");
    if (!absence.fkClassId || absence.status === ABSENCE_STATUS.CANCELLED || absence.status === ABSENCE_STATUS.NO_CLASS) {
      throw new ApiError(400, "This absence has no class to cover.");
    }
    if (substituteTeacherId === absence.fkTeacherId) throw new ApiError(400, "A teacher cannot substitute for themselves.");
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", {
      replacements: { key: `substitute:${actor.schoolId}:${absence.date}:${absence.periodIndex}` },
      transaction,
    });
    const substitute = await Teachers.findOne({
      where: { id: substituteTeacherId, fkSchoolId: actor.schoolId },
      include: [{ model: Users, as: "user", attributes: ["firstName", "lastName"] }],
      transaction,
    });
    if (!substitute) throw new ApiError(404, "Substitute teacher not found");

    const previous = await SubstituteAssignments.findOne({ where: { fkAbsenceId: absence.id }, transaction });
    if (previous && previous.fkSubstituteTeacherId === substitute.id) return;
    if (previous) await previous.destroy({ transaction });

    const busy = await busyAt(actor.schoolId, absence.date, absence.periodIndex, transaction);
    if (busy.has(substitute.id)) {
      throw new ApiError(409, `${teacherName(substitute)} already has a class in period ${absence.periodIndex} on ${absence.date}.`);
    }
    const assignment = await SubstituteAssignments.create(
      {
        fkSchoolId: actor.schoolId,
        fkAbsenceId: absence.id,
        fkTimetableSlotId: absence.fkTimetableSlotId,
        date: absence.date,
        periodIndex: absence.periodIndex,
        fkClassId: absence.fkClassId,
        fkSubjectId: absence.fkSubjectId,
        fkOriginalTeacherId: absence.fkTeacherId,
        fkSubstituteTeacherId: substitute.id,
        fkAuthorizedByUserId: actor.id,
        notes: notes || null,
      },
      { transaction },
    );
    await absence.update({ status: ABSENCE_STATUS.COVERED }, { transaction });
    await auditService.record(
      actor,
      `assigned ${teacherName(substitute)} to cover period ${absence.periodIndex} on ${absence.date}`,
      {
        entityType: "substitute_assignment",
        entityId: assignment.id,
        metadata: {
          absenceId: absence.id,
          originalTeacherId: absence.fkTeacherId,
          substituteTeacherId: substitute.id,
          classId: absence.fkClassId,
          subjectId: absence.fkSubjectId,
          replacedSubstituteId: previous ? previous.fkSubstituteTeacherId : null,
        },
      },
      { transaction },
    );
  });
  return getById(absenceId, actor.schoolId);
}

async function removeSubstitute(actor, absenceId) {
  await sequelize.transaction(async (transaction) => {
    const absence = await getById(absenceId, actor.schoolId, { transaction });
    if (!absence.substitution) throw new ApiError(400, "No substitute assigned.");
    await absence.substitution.destroy({ transaction });
    await absence.update({ status: ABSENCE_STATUS.PENDING }, { transaction });
    await auditService.record(actor, `removed substitute from absence #${absence.id}`, {
      entityType: "substitute_assignment",
      entityId: absence.substitution.id,
    }, { transaction });
  });
  return getById(absenceId, actor.schoolId);
}

async function cancel(actor, absenceId) {
  await sequelize.transaction(async (transaction) => {
    const absence = await getById(absenceId, actor.schoolId, { transaction });
    if (absence.substitution) await absence.substitution.destroy({ transaction });
    await absence.update({ status: ABSENCE_STATUS.CANCELLED }, { transaction });
    await auditService.record(actor, `cancelled absence #${absence.id}`, { entityType: "teacher_absence", entityId: absence.id }, { transaction });
  });
  return getById(absenceId, actor.schoolId);
}

module.exports = { list, getById, markAbsent, availableSubstitutes, assignSubstitute, removeSubstitute, cancel };
