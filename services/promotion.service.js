"use strict";

const { Op } = require("sequelize");
const omit = require("lodash/omit");
const {
  Students, Classes, AcademicSessions, StudentPromotions, StudentStatusEvents, Applications, Users, sequelize,
} = require("../models");
const { STUDENT_STATUS, APPLICATION_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { syncClassStatus } = require("./class.service");

const ACTIONS = { PROMOTE: "promote", HOLD: "hold", GRADUATE: "graduate" };
const OUTCOME = { PROMOTED: "Promoted", REPEATED: "Repeated" };

/** Class a held-back student repeats in the target session: explicit, same grade+section, or their own class. */
async function holdBackClass(fromClass, session, holdClassId, transaction) {
  if (holdClassId) {
    const klass = await Classes.findOne({
      where: { id: holdClassId, fkSchoolId: fromClass.fkSchoolId, fkSessionId: session.id },
      transaction,
    });
    if (!klass) throw new ApiError(400, "The repeat class is not in the target session");
    return klass;
  }
  if (fromClass.fkSessionId === session.id) return fromClass;
  const same = await Classes.findOne({
    where: { fkSchoolId: fromClass.fkSchoolId, fkSessionId: session.id, grade: fromClass.grade, section: fromClass.section },
    transaction,
  });
  if (!same) throw new ApiError(400, `No ${fromClass.label} class exists in ${session.name} for held-back students`);
  return same;
}

/**
 * Promote a class in one transaction. Every listed student must be Active in
 * the source class. Promoted students move to the target class, held-back
 * students repeat (same class, or its counterpart in the target session), and
 * graduates leave with status Graduated. Either everyone is processed or nobody.
 */
async function bulkPromote(actor, input) {
  const { fromClassId, toClassId, sessionId, date, students, graduationResult } = input;
  const ids = students.map((row) => Number(row.studentId));
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "A student is listed more than once");
  const promoting = students.filter((row) => row.action === ACTIONS.PROMOTE);
  const graduating = students.filter((row) => row.action === ACTIONS.GRADUATE);
  if (promoting.length && !toClassId) throw new ApiError(400, "Choose the class students are promoted to");
  if (graduating.length && !String(graduationResult || "").trim()) {
    throw new ApiError(400, "Graduation requires the final result");
  }

  const result = await sequelize.transaction(async (transaction) => {
    const session = await AcademicSessions.findOne({ where: { id: sessionId, fkSchoolId: actor.schoolId }, transaction });
    if (!session) throw new ApiError(404, "Target session not found");
    const fromClass = await Classes.findOne({ where: { id: fromClassId, fkSchoolId: actor.schoolId }, transaction });
    if (!fromClass) throw new ApiError(404, "Source class not found");

    let toClass = null;
    if (promoting.length) {
      toClass = await Classes.findOne({
        where: { id: toClassId, fkSchoolId: actor.schoolId, fkSessionId: session.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!toClass) throw new ApiError(404, "Target class not found in that session");
      if (toClass.id === fromClass.id) throw new ApiError(400, "Choose a different target class");
    }
    const holds = students.filter((row) => row.action === ACTIONS.HOLD);
    const repeatClass = holds.length ? await holdBackClass(fromClass, session, input.holdClassId, transaction) : null;

    const rows = await Students.findAll({
      where: { id: ids, fkSchoolId: actor.schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const invalid = ids.filter((id) => {
      const row = byId.get(id);
      return !row || row.fkClassId !== fromClass.id || row.status !== STUDENT_STATUS.ACTIVE;
    });
    if (invalid.length) {
      throw new ApiError(409, `Some students are no longer active in ${fromClass.label}. Reload and try again.`, { studentIds: invalid });
    }

    // Capacity: everyone arriving must fit alongside the students already seated.
    const arrivals = new Map();
    if (toClass) arrivals.set(toClass.id, { klass: toClass, count: promoting.length });
    if (repeatClass && repeatClass.id !== fromClass.id) {
      const entry = arrivals.get(repeatClass.id) || { klass: repeatClass, count: 0 };
      entry.count += holds.length;
      arrivals.set(repeatClass.id, entry);
    }
    for (const { klass, count } of arrivals.values()) {
      if (klass.capacity == null) continue;
      const seated = await Students.count({ where: { fkClassId: klass.id, status: STUDENT_STATUS.ACTIVE }, transaction });
      if (seated + count > Number(klass.capacity)) {
        throw new ApiError(409, `${klass.label} has room for ${Math.max(0, Number(klass.capacity) - seated)} more students`);
      }
    }

    const summary = { promoted: 0, repeated: 0, graduated: 0 };
    for (const entry of students) {
      const student = byId.get(Number(entry.studentId));
      if (entry.action === ACTIONS.GRADUATE) {
        await StudentStatusEvents.create({
          fkSchoolId: actor.schoolId,
          fkStudentId: student.id,
          fromStatus: student.status,
          toStatus: STUDENT_STATUS.GRADUATED,
          reason: `Graduated from ${fromClass.label}`,
          effectiveOn: date,
          fkActorUserId: actor.id,
          fkClassId: fromClass.id,
          fkSessionId: session.id,
          finalResult: String(graduationResult).trim(),
        }, { transaction });
        await student.update({ status: STUDENT_STATUS.GRADUATED }, { transaction });
        summary.graduated += 1;
        continue;
      }
      const target = entry.action === ACTIONS.PROMOTE ? toClass : repeatClass;
      await StudentPromotions.create({
        fkSchoolId: actor.schoolId,
        fkStudentId: student.id,
        fkFromClassId: fromClass.id,
        fkToClassId: target.id,
        fkSessionId: session.id,
        promotedOn: date,
        fkActorUserId: actor.id,
        outcome: entry.action === ACTIONS.PROMOTE ? OUTCOME.PROMOTED : OUTCOME.REPEATED,
      }, { transaction });
      if (student.fkClassId !== target.id) await student.update({ fkClassId: target.id }, { transaction });
      if (entry.action === ACTIONS.PROMOTE) summary.promoted += 1;
      else summary.repeated += 1;
    }

    await syncClassStatus([fromClass.id, toClass && toClass.id, repeatClass && repeatClass.id], transaction);
    await auditService.record(
      actor,
      `bulk promotion from ${fromClass.label}: ${summary.promoted} promoted, ${summary.repeated} held back, ${summary.graduated} graduated`,
      {
        entityType: "class",
        entityId: fromClass.id,
        metadata: {
          fromClassId: fromClass.id,
          toClassId: toClass ? toClass.id : null,
          repeatClassId: repeatClass ? repeatClass.id : null,
          sessionId: session.id,
          date,
          students: students.map((row) => ({ studentId: Number(row.studentId), action: row.action })),
          ...summary,
        },
      },
      { transaction },
    );

    return {
      ...summary,
      fromClass: { id: fromClass.id, label: fromClass.label },
      toClass: toClass ? { id: toClass.id, label: toClass.label } : null,
      repeatClass: repeatClass ? { id: repeatClass.id, label: repeatClass.label } : null,
      session: { id: session.id, name: session.name },
    };
  });
  return result;
}

const name = (user) => (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : null);
const studentName = (row) => (row ? `${row.firstName} ${row.lastName === "-" ? "" : row.lastName}`.trim() : "—");

/** Promotions, hold-backs, graduations and new admissions, newest first. */
async function history(schoolId, { page = 1, pageSize = 20, type } = {}) {
  const studentAttrs = ["id", "firstName", "lastName", "admissionNo"];
  const actorAttrs = ["id", "firstName", "lastName", "email"];
  const [promotions, graduations, admissions] = await Promise.all([
    type && !["Promotion", "Repeat"].includes(type) ? [] : StudentPromotions.findAll({
      where: { fkSchoolId: schoolId, ...(type ? { outcome: type === "Repeat" ? OUTCOME.REPEATED : OUTCOME.PROMOTED } : {}) },
      include: [
        { model: Students, as: "student", attributes: studentAttrs },
        { model: Classes, as: "fromClass", attributes: ["id", "label"] },
        { model: Classes, as: "toClass", attributes: ["id", "label"] },
        { model: AcademicSessions, as: "session", attributes: ["id", "name"] },
        { model: Users, as: "actor", attributes: actorAttrs },
      ],
    }),
    type && type !== "Graduation" ? [] : StudentStatusEvents.findAll({
      where: { fkSchoolId: schoolId, toStatus: STUDENT_STATUS.GRADUATED },
    }),
    type && type !== "New Admission" ? [] : Applications.findAll({
      where: { fkSchoolId: schoolId, status: APPLICATION_STATUS.ENROLLED, enrolledStudentId: { [Op.ne]: null } },
      attributes: ["id", "enrolledStudentId", "fkClassId", "updated_at"],
    }),
  ]);

  const lookupIds = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];
  const studentIds = [...lookupIds(graduations, "fkStudentId"), ...lookupIds(admissions, "enrolledStudentId")];
  const classIds = [...lookupIds(graduations, "fkClassId"), ...lookupIds(admissions, "fkClassId")];
  const [studentRows, classRows, actorRows, sessionRows] = await Promise.all([
    studentIds.length ? Students.findAll({ where: { id: studentIds }, attributes: [...studentAttrs, "admissionDate"] }) : [],
    classIds.length ? Classes.findAll({ where: { id: classIds }, attributes: ["id", "label", "fkSessionId"] }) : [],
    graduations.length ? Users.findAll({ where: { id: lookupIds(graduations, "fkActorUserId") }, attributes: actorAttrs }) : [],
    AcademicSessions.findAll({ where: { fkSchoolId: schoolId }, attributes: ["id", "name"] }),
  ]);
  const map = (rows) => new Map(rows.map((row) => [row.id, row]));
  const students = map(studentRows);
  const classes = map(classRows);
  const actors = map(actorRows);
  const sessions = map(sessionRows);
  const auditActors = new Map();
  if (admissions.length) {
    const logs = await sequelize.query(
      `SELECT DISTINCT ON (entity_id) entity_id, fk_user_id AS actor_user_id, actor_label FROM audit_logs
       WHERE fk_school_id = :schoolId AND entity_type = 'student' AND action LIKE 'enrolled %' AND entity_id IN (:ids)
       ORDER BY entity_id, id DESC`,
      { replacements: { schoolId, ids: admissions.map((row) => row.enrolledStudentId) }, type: sequelize.QueryTypes.SELECT },
    );
    const users = map(await Users.findAll({ where: { id: lookupIds(logs, "actor_user_id") }, attributes: actorAttrs }));
    for (const log of logs) {
      const label = name(users.get(Number(log.actor_user_id))) || String(log.actor_label).replace(/\s*\(.*\)$/, "");
      auditActors.set(Number(log.entity_id), label);
    }
  }

  const events = [
    ...promotions.map((row) => ({
      id: `promotion-${row.id}`,
      date: row.promotedOn,
      recordedAt: row.get("created_at"),
      type: row.outcome === OUTCOME.REPEATED ? "Repeat" : "Promotion",
      student: row.student ? { id: row.student.id, name: studentName(row.student), admissionNo: row.student.admissionNo } : null,
      fromClass: row.fromClass ? row.fromClass.label : null,
      toClass: row.toClass ? row.toClass.label : null,
      session: row.session ? row.session.name : null,
      recordedBy: name(row.actor),
    })),
    ...graduations.map((row) => {
      const student = students.get(row.fkStudentId);
      const klass = classes.get(row.fkClassId);
      return {
        id: `graduation-${row.id}`,
        date: row.effectiveOn,
        recordedAt: row.get("created_at"),
        type: "Graduation",
        student: student ? { id: student.id, name: studentName(student), admissionNo: student.admissionNo } : null,
        fromClass: klass ? klass.label : null,
        toClass: null,
        session: sessions.get(row.fkSessionId) ? sessions.get(row.fkSessionId).name : null,
        recordedBy: name(actors.get(row.fkActorUserId)),
      };
    }),
    ...admissions.map((row) => {
      const student = students.get(row.enrolledStudentId);
      const klass = classes.get(row.fkClassId);
      return {
        id: `admission-${row.id}`,
        date: (student && student.admissionDate) || new Date(row.get("updated_at")).toISOString().slice(0, 10),
        recordedAt: row.get("updated_at"),
        type: "New Admission",
        student: student ? { id: student.id, name: studentName(student), admissionNo: student.admissionNo } : null,
        fromClass: null,
        toClass: klass ? klass.label : null,
        session: klass && sessions.get(klass.fkSessionId) ? sessions.get(klass.fkSessionId).name : null,
        recordedBy: auditActors.get(row.enrolledStudentId) || null,
      };
    }),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)) || new Date(b.recordedAt) - new Date(a.recordedAt));

  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 200);
  const current = Math.max(Number(page) || 1, 1);
  return {
    events: events.slice((current - 1) * size, current * size).map((event) => omit(event, "recordedAt")),
    pagination: { total: events.length, page: current, pageSize: size, totalPages: Math.ceil(events.length / size) },
  };
}

module.exports = { bulkPromote, history, ACTIONS };
