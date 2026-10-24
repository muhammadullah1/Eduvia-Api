"use strict";

/**
 * Student lifecycle (SRS 4.3.3, p15–16): activation/deactivation, graduation,
 * strike-off, and readmission. Every change is one append-only
 * student_status_events row plus an audit entry, written in the same
 * transaction that changes the student and re-derives class status.
 * Promotion lives in student.service (single) and promotion.service (bulk).
 */
const { Students, Classes, AcademicSessions, StudentStatusEvents, StudentFeeMonths, sequelize } = require("../models");
const { STUDENT_STATUS: S, LIFECYCLE_EVENT: E, LIFECYCLE_REASONS, LIFECYCLE_HISTORY_TYPES: HISTORY_TYPES } = require("../constants");
const ApiError = require("../utils/ApiError");
const { today } = require("../utils/dates");
const { classRankKey } = require("../utils/class_order");
const auditService = require("./audit.service");
const { syncClassStatus, enrolledCount } = require("./class.service");

/** from status → { to status: event type }. Anything else is a 409. */
const TRANSITIONS = {
  [S.PENDING]: { [S.ACTIVE]: E.ENROLLED, [S.WITHDRAWN]: E.WITHDRAWN },
  [S.ACTIVE]: { [S.INACTIVE]: E.DEACTIVATED, [S.GRADUATED]: E.GRADUATED, [S.STRUCK_OFF]: E.STRUCK_OFF },
  [S.INACTIVE]: { [S.ACTIVE]: E.REACTIVATED, [S.GRADUATED]: E.GRADUATED, [S.STRUCK_OFF]: E.STRUCK_OFF },
  [S.STRUCK_OFF]: { [S.ACTIVE]: E.READMITTED },
  [S.GRADUATED]: { [S.ACTIVE]: E.READMITTED },
  [S.WITHDRAWN]: { [S.ACTIVE]: E.READMITTED },
};

const LABEL = { StruckOff: "Struck off" };
const AUDIT_VERB = { [E.STRUCK_OFF]: "struck off", [E.WITHDRAWN]: "withdrew enrollment of" };
const label = (status) => LABEL[status] || status;

function allowedTransitions(status) {
  return Object.entries(TRANSITIONS[status] || {}).map(([to, eventType]) => ({ to, eventType }));
}

const isoDay = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10));

/** D1: past dates are fine, future dates are not, and nothing before admission. */
function assertEffectiveDate(student, date) {
  const day = isoDay(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ApiError(400, "A valid effective date is required");
  if (day > today()) throw new ApiError(400, "The effective date cannot be in the future");
  const admitted = student.admittedOn ? isoDay(student.admittedOn) : null;
  if (admitted && day < admitted) throw new ApiError(400, `The effective date cannot be before admission (${admitted})`);
}

/** Seats left in a class, counting everyone still enrolled (Active, Inactive, Pending). */
async function seatsLeft(klass, transaction) {
  if (klass.capacity == null) return Infinity;
  return Number(klass.capacity) - (await enrolledCount(klass.id, transaction));
}

async function assertSeats(klass, needed, transaction) {
  const left = await seatsLeft(klass, transaction);
  if (left < needed) throw new ApiError(409, `${klass.label} has room for ${Math.max(0, left)} more student${left === 1 ? "" : "s"}`);
}

/** A class is the final grade when no class in its session ranks above it. */
async function isFinalGrade(klass, transaction) {
  const classes = await Classes.findAll({
    where: { fkSchoolId: klass.fkSchoolId, fkSessionId: klass.fkSessionId },
    attributes: ["id", "grade", "label"],
    transaction,
  });
  const [rank, number] = classRankKey(klass);
  return !classes.some((other) => {
    const [r, n] = classRankKey(other);
    return r < 100 && (r > rank || (r === rank && n > number));
  });
}

async function outstandingOf(studentId, transaction) {
  const months = await StudentFeeMonths.findAll({ where: { fkStudentId: studentId }, transaction });
  const total = months.reduce(
    (sum, month) => sum + Math.max(0, Number(month.getDataValue("netAmount")) - Number(month.getDataValue("paidAmount"))),
    0,
  );
  return Math.round(total * 100) / 100;
}

async function sessionFor(klass, schoolId, transaction) {
  if (klass) return AcademicSessions.findByPk(klass.fkSessionId, { transaction });
  return AcademicSessions.findOne({ where: { fkSchoolId: schoolId, isCurrent: true }, transaction });
}

/**
 * Shared graduation (SRS p15: date, final class, session, final result).
 * Used by the status endpoint and by bulk promotion. D3: only from the final
 * grade unless `override` is set; the override is stored on the event and
 * audited by the caller.
 */
async function graduate(actor, student, { date, finalResult, override = false, reason }, transaction) {
  if (!TRANSITIONS[student.status] || !TRANSITIONS[student.status][S.GRADUATED]) {
    throw new ApiError(409, `A ${label(student.status)} student cannot graduate`);
  }
  if (!String(finalResult || "").trim()) throw new ApiError(400, "Graduation requires the final result");
  assertEffectiveDate(student, date);
  const klass = student.fkClassId ? await Classes.findByPk(student.fkClassId, { transaction }) : null;
  if (!klass) throw new ApiError(400, "The student has no class to graduate from");
  const final = await isFinalGrade(klass, transaction);
  if (!final && !override) {
    throw new ApiError(409, `${klass.label} is not the final grade. Use the graduation override to graduate from it.`, { code: "NOT_FINAL_GRADE" });
  }
  const session = await sessionFor(klass, actor.schoolId, transaction);
  const event = await StudentStatusEvents.create({
    fkSchoolId: actor.schoolId,
    fkStudentId: student.id,
    fromStatus: student.status,
    toStatus: S.GRADUATED,
    eventType: E.GRADUATED,
    reason: String(reason || `Graduated from ${klass.label}`).trim(),
    effectiveOn: isoDay(date),
    fkActorUserId: actor.id,
    fkClassId: klass.id,
    fkSessionId: session ? session.id : null,
    finalResult: String(finalResult).trim(),
    graduationOverride: !final,
  }, { transaction });
  await student.update({ status: S.GRADUATED }, { transaction });
  return { event, klass, override: !final };
}

/**
 * Change one student's status. Body: status, reason, effectiveOn, plus
 * reasonCategory (Inactive / StruckOff), academicStatus (StruckOff),
 * transferToSchool (StruckOff → Transfer out), finalResult and
 * graduationOverride (Graduated), classId (+ sessionId) for Enrolled/Readmitted.
 */
async function changeStatus(actor, id, input) {
  const { status, reason, effectiveOn } = input;
  if (!String(reason || "").trim()) throw new ApiError(400, "A reason is required");

  return sequelize.transaction(async (transaction) => {
    const done = await applyChange(transaction);
    const { student, from, eventType, metadata } = done;
    await auditService.record(actor, `${AUDIT_VERB[eventType] || eventType.toLowerCase()} student #${student.id} (${label(from)} → ${label(student.status)})`, {
      entityType: "student",
      entityId: student.id,
      metadata: { from, to: student.status, eventType, reason, effectiveOn, ...metadata },
    }, { transaction });
    return student.id;
  });

  async function applyChange(transaction) {
    const student = await Students.findOne({
      where: { id, fkSchoolId: actor.schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!student) throw new ApiError(404, "Student not found");
    const from = student.status;
    const eventType = TRANSITIONS[from] && TRANSITIONS[from][status];
    if (!eventType) {
      throw new ApiError(409, `A ${label(from)} student cannot be changed to ${label(status)}`, {
        code: "INVALID_TRANSITION",
        allowed: allowedTransitions(from).map((t) => t.to),
      });
    }
    assertEffectiveDate(student, effectiveOn);
    const previousClassId = student.fkClassId;
    const trimmed = String(reason).trim();

    if (eventType === E.GRADUATED) {
      const { klass, override } = await graduate(actor, student, {
        date: effectiveOn, finalResult: input.finalResult, override: Boolean(input.graduationOverride), reason: trimmed,
      }, transaction);
      await syncClassStatus(previousClassId, transaction);
      return { student, from, eventType, metadata: { classId: klass.id, finalResult: input.finalResult, graduationOverride: override } };
    }

    const fields = {};
    let klass = previousClassId ? await Classes.findByPk(previousClassId, { transaction }) : null;
    if (eventType === E.DEACTIVATED || eventType === E.STRUCK_OFF) {
      const allowed = LIFECYCLE_REASONS[status];
      if (!allowed.includes(input.reasonCategory)) {
        throw new ApiError(400, `Choose a reason category: ${allowed.join(", ")}`);
      }
      fields.reasonCategory = input.reasonCategory;
    }
    if (eventType === E.STRUCK_OFF) {
      if (!String(input.academicStatus || "").trim()) throw new ApiError(400, "Strike-off requires the academic status");
      const outstanding = await outstandingOf(student.id, transaction);
      fields.academicStatus = String(input.academicStatus).trim();
      fields.outstandingAmount = outstanding;
      fields.financialStatus = `Outstanding ${outstanding.toFixed(2)}`;
      if (input.transferToSchool && input.reasonCategory !== "Transfer out") {
        throw new ApiError(400, "A destination school is only recorded for Transfer out");
      }
      fields.transferToSchool = input.reasonCategory === "Transfer out" ? String(input.transferToSchool || "").trim() || null : null;
    }
    if (eventType === E.READMITTED || eventType === E.ENROLLED) {
      const classId = input.classId || (eventType === E.ENROLLED ? previousClassId : null);
      if (!classId) throw new ApiError(400, "Choose the class the student joins");
      if (eventType === E.READMITTED && !input.sessionId) throw new ApiError(400, "Choose the academic session");
      const where = { id: classId, fkSchoolId: actor.schoolId };
      if (input.sessionId) where.fkSessionId = input.sessionId;
      klass = await Classes.findOne({ where, transaction, lock: transaction.LOCK.NO_KEY_UPDATE });
      if (!klass) throw new ApiError(404, "Class not found in that session");
      if (klass.status === "Archived") throw new ApiError(409, "That class is archived");
      if (klass.id !== previousClassId) await assertSeats(klass, 1, transaction);
      fields.fkToClassId = klass.id;
    }

    const session = await sessionFor(klass, actor.schoolId, transaction);
    await StudentStatusEvents.create({
      fkSchoolId: actor.schoolId,
      fkStudentId: student.id,
      fromStatus: from,
      toStatus: status,
      eventType,
      reason: trimmed,
      effectiveOn: isoDay(effectiveOn),
      fkActorUserId: actor.id,
      fkClassId: previousClassId,
      fkSessionId: session ? session.id : null,
      ...fields,
    }, { transaction });
    await student.update({ status, ...(fields.fkToClassId ? { fkClassId: fields.fkToClassId } : {}) }, { transaction });
    await syncClassStatus([previousClassId, fields.fkToClassId], transaction);
    return { student, from, eventType, metadata: fields };
  }
}

// ---- history -----------------------------------------------------------------

/**
 * One permanent lifecycle feed: promotions/hold-backs, status events, and
 * enrollments of admitted applications, filtered and paginated in SQL.
 */
async function history(schoolId, filters = {}) {
  const size = Math.min(Math.max(Number(filters.pageSize) || 20, 1), 200);
  const page = Math.max(Number(filters.page) || 1, 1);
  const types = [].concat(filters.type || []).filter((t) => HISTORY_TYPES.includes(t));
  const where = [];
  const replacements = { schoolId, limit: size, offset: (page - 1) * size };
  if (types.length) { where.push("u.type IN (:types)"); replacements.types = types; }
  if (filters.from) { where.push("u.date >= :from"); replacements.from = filters.from; }
  if (filters.to) { where.push("u.date <= :to"); replacements.to = filters.to; }
  if (filters.classId) { where.push("(u.from_class_id = :classId OR u.to_class_id = :classId)"); replacements.classId = Number(filters.classId); }
  if (filters.sessionId) { where.push("u.session_id = :sessionId"); replacements.sessionId = Number(filters.sessionId); }
  if (filters.reasonCategory) { where.push("u.reason_category = :category"); replacements.category = filters.reasonCategory; }
  if (filters.studentId) { where.push("u.student_id = :studentId"); replacements.studentId = Number(filters.studentId); }
  if (String(filters.q || "").trim()) {
    where.push("(s.first_name || ' ' || s.last_name ILIKE :q OR s.admission_no ILIKE :q)");
    replacements.q = `%${String(filters.q).trim()}%`;
  }

  const sql = `
    WITH u AS (
      SELECT 'promotion-' || p.id AS id, p.promoted_on AS date, p.created_at AS recorded_at,
        CASE WHEN p.outcome = 'Repeated' THEN 'Repeated' ELSE 'Promoted' END AS type,
        p.fk_student_id AS student_id, p.fk_from_class_id AS from_class_id, p.fk_to_class_id AS to_class_id,
        p.fk_session_id AS session_id, p.fk_actor_user_id AS actor_id,
        NULL::text AS from_status, NULL::text AS to_status, NULL::text AS reason, NULL::text AS reason_category,
        NULL::text AS final_result, NULL::text AS academic_status, NULL::numeric AS outstanding_amount,
        NULL::text AS transfer_to_school, FALSE AS graduation_override
      FROM student_promotions p WHERE p.fk_school_id = :schoolId
      UNION ALL
      SELECT 'status-' || e.id, e.effective_on, e.created_at, e.event_type,
        e.fk_student_id, e.fk_class_id, e.fk_to_class_id, e.fk_session_id, e.fk_actor_user_id,
        e.from_status, e.to_status, e.reason, e.reason_category, e.final_result, e.academic_status,
        e.outstanding_amount, e.transfer_to_school, e.graduation_override
      FROM student_status_events e WHERE e.fk_school_id = :schoolId
      UNION ALL
      SELECT 'admission-' || a.id, COALESCE(st.admission_date, a.updated_at::date), a.updated_at, 'Enrolled',
        a.enrolled_student_id, NULL, a.fk_class_id, COALESCE(c.fk_session_id, a.fk_session_id),
        (SELECT l.fk_user_id FROM audit_logs l WHERE l.fk_school_id = :schoolId AND l.entity_type = 'student'
           AND l.entity_id = a.enrolled_student_id AND l.action LIKE 'enrolled %' ORDER BY l.id DESC LIMIT 1),
        'Pending', 'Active', 'Admission approved', NULL, NULL, NULL, NULL, NULL, FALSE
      FROM applications a
      JOIN students st ON st.id = a.enrolled_student_id
      LEFT JOIN classes c ON c.id = a.fk_class_id
      WHERE a.fk_school_id = :schoolId AND a.status = 'Enrolled' AND a.archived_at IS NULL
    )
    SELECT u.*, COUNT(*) OVER() AS total,
      s.first_name, s.last_name, s.admission_no,
      fc.label AS from_class, tc.label AS to_class, ses.name AS session_name,
      NULLIF(TRIM(COALESCE(us.first_name, '') || ' ' || COALESCE(us.last_name, '')), '') AS actor_name
    FROM u
    JOIN students s ON s.id = u.student_id
    LEFT JOIN classes fc ON fc.id = u.from_class_id
    LEFT JOIN classes tc ON tc.id = u.to_class_id
    LEFT JOIN academic_sessions ses ON ses.id = u.session_id
    LEFT JOIN users us ON us.id = u.actor_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY u.date DESC, u.recorded_at DESC, u.id DESC
    LIMIT :limit OFFSET :offset`;
  const rows = await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    events: rows.map((row) => ({
      id: row.id,
      date: isoDay(row.date),
      type: row.type,
      student: {
        id: row.student_id,
        name: `${row.first_name} ${row.last_name === "-" ? "" : row.last_name}`.trim(),
        admissionNo: row.admission_no,
      },
      fromClass: row.from_class,
      toClass: row.to_class,
      session: row.session_name,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      reasonCategory: row.reason_category,
      finalResult: row.final_result,
      academicStatus: row.academic_status,
      outstandingAmount: row.outstanding_amount == null ? null : Number(row.outstanding_amount),
      transferToSchool: row.transfer_to_school,
      graduationOverride: Boolean(row.graduation_override),
      recordedBy: row.actor_name,
    })),
    pagination: { total, page, pageSize: size, totalPages: Math.ceil(total / size) },
  };
}

/** A student's full lifecycle, oldest first, with what they can change to next. */
async function timeline(actor, studentId) {
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const { events } = await history(actor.schoolId, { studentId: student.id, pageSize: 200 });
  const klass = student.fkClassId ? await Classes.findByPk(student.fkClassId) : null;
  return {
    studentId: student.id,
    status: student.status,
    admittedOn: student.getDataValue("admissionDate") || null,
    finalGrade: klass ? await isFinalGrade(klass) : false,
    outstanding: await outstandingOf(student.id),
    allowed: allowedTransitions(student.status),
    reasons: LIFECYCLE_REASONS,
    events: events.reverse(),
  };
}

module.exports = {
  TRANSITIONS,
  HISTORY_TYPES,
  allowedTransitions,
  assertEffectiveDate,
  assertSeats,
  isFinalGrade,
  graduate,
  changeStatus,
  history,
  timeline,
  outstandingOf,
};
