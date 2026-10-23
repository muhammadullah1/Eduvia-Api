"use strict";

/**
 * Super Master (EDUVIA-14): the one teacher explicitly assigned to a class who is
 * responsible for its attendance for the whole school day. On a day the Super Master
 * is marked absent, the substitute(s) officially assigned to cover them in that class
 * on that date share the responsibility. Nothing is ever inferred from the timetable
 * or from who marked last.
 *
 * - "assigned": the Super Master is an Active teacher with an active user account.
 * - "inactive": a teacher is set but archived/not Active, so nobody is responsible.
 * - "unassigned": no Super Master yet.
 * A teacher may be Super Master of more than one class (the SRS has no one-class rule).
 */
const { QueryTypes } = require("sequelize");
const { sequelize, Classes, Teachers, Users, AttendanceReminders } = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const { today: schoolToday } = require("../utils/dates");
const auditService = require("./audit.service");

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();

/** Responsibility per class on `date`: { [classId]: { state, superMaster, absent, substitutes, recipients } }. */
async function responsibility(schoolId, classIds, date = schoolToday()) {
  const ids = [...new Set(classIds.map(Number))];
  if (!ids.length) return {};
  const rows = await sequelize.query(
    `SELECT c.id AS class_id, t.id AS teacher_id, u.id AS user_id, u.first_name, u.last_name,
            (t.archived_at IS NULL AND t.status = 'Active' AND u.archived_at IS NULL AND u.status = 'active') AS active,
            EXISTS (SELECT 1 FROM teacher_absences ta
                     WHERE ta.fk_teacher_id = t.id AND ta.date = :date AND ta.status <> 'Cancelled' AND ta.archived_at IS NULL) AS absent
       FROM classes c
       LEFT JOIN teachers t ON t.id = c.fk_super_master_teacher_id
       LEFT JOIN users u ON u.id = t.fk_user_id
      WHERE c.fk_school_id = :schoolId AND c.id IN (:ids)`,
    { replacements: { schoolId, ids, date }, type: QueryTypes.SELECT },
  );
  const subs = await sequelize.query(
    `SELECT DISTINCT ON (sa.fk_class_id, st.id) sa.fk_class_id AS class_id, st.id AS teacher_id, su.id AS user_id,
            su.first_name, su.last_name, sa.period_index
       FROM substitute_assignments sa
       JOIN classes c ON c.id = sa.fk_class_id AND c.fk_super_master_teacher_id = sa.fk_original_teacher_id
       JOIN teachers st ON st.id = sa.fk_substitute_teacher_id AND st.archived_at IS NULL AND st.status = 'Active'
       JOIN users su ON su.id = st.fk_user_id AND su.archived_at IS NULL AND su.status = 'active'
      WHERE sa.fk_school_id = :schoolId AND sa.date = :date AND sa.fk_class_id IN (:ids)
        AND sa.archived_at IS NULL AND sa.status <> 'Cancelled'
      ORDER BY sa.fk_class_id, st.id, sa.period_index`,
    { replacements: { schoolId, ids, date }, type: QueryTypes.SELECT },
  );
  const out = {};
  for (const r of rows) {
    const state = !r.teacher_id ? "unassigned" : r.active ? "assigned" : "inactive";
    const superMaster = r.teacher_id ? { teacherId: r.teacher_id, userId: r.user_id, name: fullName(r), active: Boolean(r.active) } : null;
    const substitutes = state === "assigned" && r.absent
      ? subs.filter((s) => s.class_id === r.class_id).sort((a, b) => a.period_index - b.period_index)
        .map((s) => ({ teacherId: s.teacher_id, userId: s.user_id, name: fullName(s) }))
      : [];
    // Who reminders go to: the Super Master, or that day's substitute(s) while they are away.
    const recipients = state !== "assigned" ? [] : substitutes.length ? substitutes : [superMaster];
    out[r.class_id] = { state, superMaster, absent: state === "assigned" && Boolean(r.absent), substitutes, recipients };
  }
  return out;
}

/** 403 unless `user` (a teacher) is the class's Super Master or that day's substitute. */
async function assertCanMark(user, classId, date = schoolToday()) {
  if (user.role !== USER_ROLES.TEACHER) return;
  const teacher = await Teachers.findOne({ where: { fkUserId: user.id, fkSchoolId: user.schoolId } });
  if (!teacher) throw new ApiError(403, "No teacher profile for this account.");
  const r = (await responsibility(user.schoolId, [classId], date))[Number(classId)];
  if (!r) throw new ApiError(404, "Class not found");
  if (r.state !== "assigned") {
    throw new ApiError(403, "This class has no active Super Master yet, so attendance can't be taken here. Ask the office to assign one.");
  }
  if (r.superMaster.teacherId === teacher.id || r.substitutes.some((s) => s.teacherId === teacher.id)) return;
  throw new ApiError(403, "Only this class's Super Master, or the substitute assigned to cover them today, can take its attendance.");
}

/** Classes the signed-in teacher is responsible for on `date`. */
async function classesFor(user, date = schoolToday()) {
  const teacher = await Teachers.findOne({ where: { fkUserId: user.id, fkSchoolId: user.schoolId } });
  if (!teacher) return [];
  const candidates = await sequelize.query(
    `SELECT c.id FROM classes c WHERE c.fk_school_id = :schoolId AND c.archived_at IS NULL AND (
        c.fk_super_master_teacher_id = :tid OR EXISTS (
          SELECT 1 FROM substitute_assignments sa WHERE sa.fk_class_id = c.id AND sa.date = :date
             AND sa.fk_substitute_teacher_id = :tid AND sa.archived_at IS NULL AND sa.status <> 'Cancelled'))`,
    { replacements: { schoolId: user.schoolId, tid: teacher.id, date }, type: QueryTypes.SELECT },
  );
  const resp = await responsibility(user.schoolId, candidates.map((c) => c.id), date);
  const classes = await Classes.findAll({ where: { id: Object.keys(resp) }, attributes: ["id", "label"], order: [["id", "ASC"]] });
  return classes.flatMap((klass) => {
    const r = resp[klass.id];
    if (r.state !== "assigned") return [];
    if (r.superMaster.teacherId === teacher.id) return [{ classId: klass.id, classLabel: klass.label, role: "SuperMaster", absent: r.absent }];
    if (r.substitutes.some((s) => s.teacherId === teacher.id)) {
      return [{ classId: klass.id, classLabel: klass.label, role: "Substitute", coveringFor: r.superMaster.name }];
    }
    return [];
  });
}

/** Management overview: every active class with its Super Master, plus the teachers that can be assigned. */
async function overview(schoolId) {
  const classes = await Classes.findAll({ where: { fkSchoolId: schoolId }, attributes: ["id", "label", "status"], order: [["id", "ASC"]] });
  const resp = await responsibility(schoolId, classes.map((c) => c.id));
  const teachers = await sequelize.query(
    `SELECT t.id AS teacher_id, u.first_name, u.last_name FROM teachers t JOIN users u ON u.id = t.fk_user_id
      WHERE t.fk_school_id = :schoolId AND t.archived_at IS NULL AND t.status = 'Active' AND u.archived_at IS NULL AND u.status = 'active'
      ORDER BY u.first_name, u.last_name`,
    { replacements: { schoolId }, type: QueryTypes.SELECT },
  );
  return {
    classes: classes.map((c) => ({
      classId: c.id,
      classLabel: c.label,
      classStatus: c.status,
      state: resp[c.id].state,
      superMaster: resp[c.id].superMaster,
    })),
    teachers: teachers.map((t) => ({ teacherId: t.teacher_id, name: fullName(t) })),
  };
}

/** Assign, change or clear (teacherId null) a class's Super Master. Audited with before/after. */
async function assign(actor, classId, teacherId) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  let teacher = null;
  if (teacherId) {
    teacher = await Teachers.findOne({
      where: { id: teacherId, fkSchoolId: actor.schoolId },
      include: [{ model: Users, as: "user", attributes: ["id", "firstName", "lastName", "status"] }],
    });
    if (!teacher) throw new ApiError(404, "Teacher not found");
    if (teacher.status !== "Active" || !teacher.user || teacher.user.status !== "active") {
      throw new ApiError(409, "Only an active teacher can be a Super Master.");
    }
  }
  const before = klass.fkSuperMasterTeacherId || null;
  const after = teacher ? teacher.id : null;
  if (before === after) return (await overview(actor.schoolId)).classes.find((c) => c.classId === klass.id);
  await sequelize.transaction(async (transaction) => {
    await klass.update({ fkSuperMasterTeacherId: after }, { transaction });
    const name = teacher ? `${teacher.user.firstName} ${teacher.user.lastName}`.trim() : null;
    await auditService.record(
      actor,
      name ? `set ${name} as Super Master of ${klass.label}` : `removed the Super Master of ${klass.label}`,
      { entityType: "class_super_master", entityId: klass.id, metadata: { classId: klass.id, fromTeacherId: before, toTeacherId: after } },
      { transaction },
    );
  });
  return (await overview(actor.schoolId)).classes.find((c) => c.classId === klass.id);
}

/** Today's attendance reminders routed to `user` (Super Master, or substitute while they are away). */
async function remindersFor(user, date = schoolToday()) {
  const reminders = await AttendanceReminders.findAll({
    where: { fkSchoolId: user.schoolId, date },
    include: [{ model: Classes, as: "class", attributes: ["id", "label"] }, { model: Users, as: "sentBy", attributes: ["firstName", "lastName"] }],
    order: [["fkClassId", "ASC"]],
  });
  if (!reminders.length) return [];
  const resp = await responsibility(user.schoolId, reminders.map((r) => r.fkClassId), date);
  const taken = await sequelize.query(
    `SELECT DISTINCT fk_class_id AS class_id FROM attendances WHERE fk_school_id = :schoolId AND date = :date AND archived_at IS NULL`,
    { replacements: { schoolId: user.schoolId, date }, type: QueryTypes.SELECT },
  );
  const takenIds = new Set(taken.map((t) => t.class_id));
  return reminders
    .filter((r) => (resp[r.fkClassId]?.recipients || []).some((p) => p.userId === user.id))
    .map((r) => ({
      id: r.id,
      classId: r.fkClassId,
      classLabel: r.class?.label || "",
      date: r.date,
      sentAt: r.get("created_at"),
      sentBy: r.sentBy ? `${r.sentBy.firstName} ${r.sentBy.lastName}`.trim() : null,
      readAt: r.readAt,
      taken: takenIds.has(r.fkClassId),
      role: resp[r.fkClassId].superMaster.userId === user.id ? "SuperMaster" : "Substitute",
    }));
}

async function markReminderRead(user, id) {
  const mine = await remindersFor(user);
  if (!mine.some((r) => r.id === Number(id))) throw new ApiError(404, "Reminder not found");
  const row = await AttendanceReminders.findByPk(id);
  if (!row.readAt) await row.update({ readAt: new Date() });
  return { id: row.id, readAt: row.readAt };
}

module.exports = { responsibility, assertCanMark, classesFor, overview, assign, remindersFor, markReminderRead };
