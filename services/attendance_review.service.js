"use strict";

/**
 * Management attendance review (SRS 6.3, roles §2): today's status per class,
 * daily and monthly reports, absentees, low attendance, reminders, and the
 * permanent change history. Editing a saved mark needs a reason, is limited
 * to the school's edit window, and writes one attendance_changes row plus an
 * audit entry. Present and Late both count as attended; Leave days are left
 * out of percentages (utils/attendance). Super Admin is exempt from the window.
 */
const { QueryTypes } = require("sequelize");
const {
  sequelize, Attendances, AttendanceChanges, AttendanceReminders, Classes, Students, Users,
} = require("../models");
const { SETTING_KEYS, ATTENDANCE_STATUS, USER_ROLES } = require("../constants");
const { attendancePercent } = require("../utils/attendance");
const ApiError = require("../utils/ApiError");
const { today: schoolToday, parse, iso } = require("../utils/dates");
const settingsService = require("./settings.service");
const auditService = require("./audit.service");
const superMasterService = require("./super_master.service");

const ATTENDED = [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE];
const fullName = (row) => [row.first_name ?? row.firstName, row.last_name ?? row.lastName].filter(Boolean).join(" ").trim();

async function rules(schoolId) {
  return settingsService.get(schoolId, SETTING_KEYS.ATTENDANCE);
}

const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86400000);

/** Last day a mark on `date` may still be changed. */
function editableUntil(date, editWindowDays) {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + editWindowDays);
  return iso(d);
}

const bypassesWindow = (actor) => actor?.role === USER_ROLES.SUPER_ADMIN;

function assertEditable(date, editWindowDays, today = schoolToday(), { bypass = false } = {}) {
  if (date > today) throw new ApiError(400, "Attendance for a future date cannot be changed.");
  if (!bypass && daysBetween(date, today) > editWindowDays) {
    const window = editWindowDays === 0 ? "on the same day" : `within ${editWindowDays} day${editWindowDays === 1 ? "" : "s"}`;
    throw new ApiError(409, `This attendance can no longer be edited. Changes are allowed ${window} of the attendance date.`);
  }
}

async function classOf(schoolId, classId) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  return klass;
}

// ---- today's status ----------------------------------------------------------

async function todayStatus(schoolId, { date = schoolToday() } = {}) {
  const classes = await Classes.findAll({ where: { fkSchoolId: schoolId, status: "Active" }, order: [["id", "ASC"]] });
  const ids = classes.map((c) => c.id);
  const [marks, rosters, reminders, teachers] = await Promise.all([
    ids.length
      ? sequelize.query(
        `SELECT a.fk_class_id AS class_id, MIN(a.created_at) AS taken_at,
                COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::int AS present,
                COUNT(*) FILTER (WHERE a.status = 'Absent')::int AS absent,
                COUNT(*) FILTER (WHERE a.status = 'Late')::int AS late,
                COUNT(*) FILTER (WHERE a.status = 'Leave')::int AS leave,
                (ARRAY_AGG(a.fk_marked_by_user_id ORDER BY a.created_at))[1] AS marked_by
           FROM attendances a
          WHERE a.fk_school_id = :schoolId AND a.date = :date AND a.archived_at IS NULL AND a.fk_class_id IN (:ids)
          GROUP BY a.fk_class_id`,
        { replacements: { schoolId, date, ids }, type: QueryTypes.SELECT },
      )
      : [],
    ids.length
      ? sequelize.query(
        `SELECT fk_class_id AS class_id, COUNT(*)::int AS students FROM students
          WHERE fk_school_id = :schoolId AND status = 'Active' AND archived_at IS NULL AND fk_class_id IN (:ids)
          GROUP BY fk_class_id`,
        { replacements: { schoolId, ids }, type: QueryTypes.SELECT },
      )
      : [],
    AttendanceReminders.findAll({ where: { fkSchoolId: schoolId, date } }),
    superMasterService.responsibility(schoolId, ids, date),
  ]);
  const byClass = Object.fromEntries(marks.map((m) => [m.class_id, m]));
  const sizes = Object.fromEntries(rosters.map((r) => [r.class_id, r.students]));
  const reminded = Object.fromEntries(reminders.map((r) => [r.fkClassId, r.get("created_at")]));
  const markerIds = [...new Set(marks.map((m) => m.marked_by).filter(Boolean))];
  const markers = markerIds.length
    ? Object.fromEntries((await Users.findAll({ where: { id: markerIds }, attributes: ["id", "firstName", "lastName"] })).map((u) => [u.id, fullName(u)]))
    : {};

  const rows = classes.map((klass) => {
    const m = byClass[klass.id];
    return {
      classId: klass.id,
      classLabel: klass.label,
      // Responsible teacher: the explicitly assigned Super Master, or today's substitute while they are away.
      teacher: teachers[klass.id]?.recipients[0]?.name || null,
      superMaster: teachers[klass.id]?.superMaster?.name || null,
      superMasterState: teachers[klass.id]?.state || "unassigned",
      superMasterAbsent: Boolean(teachers[klass.id]?.absent),
      substitutes: (teachers[klass.id]?.substitutes || []).map((t) => t.name),
      markedBy: m?.marked_by ? markers[m.marked_by] || null : null,
      taken: Boolean(m),
      takenAt: m ? m.taken_at : null,
      students: sizes[klass.id] || 0,
      present: m ? m.present : null,
      absent: m ? m.absent : null,
      late: m ? m.late : null,
      leave: m ? m.leave : null,
      remindedAt: reminded[klass.id] || null,
    };
  });
  const taken = rows.filter((r) => r.taken).length;
  return { date, total: rows.length, taken, pending: rows.length - taken, classes: rows };
}

// ---- daily report -------------------------------------------------------------

async function daily(schoolId, { classId, date }, actor = null) {
  const klass = await classOf(schoolId, classId);
  const { editWindowDays } = await rules(schoolId);
  const rows = await sequelize.query(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.admission_no, a.id AS attendance_id, a.status, a.updated_at,
            (SELECT COUNT(*)::int FROM attendance_changes ch WHERE ch.fk_attendance_id = a.id) AS changes
       FROM students s
       LEFT JOIN attendances a ON a.fk_student_id = s.id AND a.date = :date AND a.archived_at IS NULL
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        AND ((s.fk_class_id = :classId AND s.status = 'Active') OR a.fk_class_id = :classId)
      ORDER BY s.first_name, s.last_name, s.id`,
    { replacements: { schoolId, classId: klass.id, date }, type: QueryTypes.SELECT },
  );
  const students = rows.map((r) => ({
    studentId: r.student_id,
    name: fullName(r),
    admissionNo: r.admission_no,
    attendanceId: r.attendance_id,
    status: r.status || null,
    changes: r.changes || 0,
  }));
  const count = (status) => students.filter((s) => s.status === status).length;
  const today = schoolToday();
  const withinWindow = date <= today && daysBetween(date, today) <= editWindowDays;
  return {
    classId: klass.id,
    classLabel: klass.label,
    date,
    taken: students.some((s) => s.status),
    summary: {
      total: students.length,
      present: count("Present"),
      absent: count("Absent"),
      late: count("Late"),
      leave: count("Leave"),
      unmarked: count(null),
    },
    editWindowDays,
    editableUntil: editableUntil(date, editWindowDays),
    canEdit: withinWindow || (date <= today && bypassesWindow(actor)),
    windowBypass: bypassesWindow(actor),
    students,
  };
}

/** Change one saved mark: reason required, inside the edit window, logged forever. */
async function edit(actor, attendanceId, { status, reason }) {
  const row = await Attendances.findOne({ where: { id: attendanceId, fkSchoolId: actor.schoolId } });
  if (!row) throw new ApiError(404, "Attendance record not found");
  const { editWindowDays } = await rules(actor.schoolId);
  assertEditable(row.date, editWindowDays, schoolToday(), { bypass: bypassesWindow(actor) });
  if (row.status === status) throw new ApiError(409, `The student is already marked ${status}.`);
  const from = row.status;
  const text = String(reason).trim();
  return sequelize.transaction(async (transaction) => {
    await row.update({ status }, { transaction });
    const change = await AttendanceChanges.create(
      {
        fkSchoolId: actor.schoolId,
        fkAttendanceId: row.id,
        fkStudentId: row.fkStudentId,
        fkClassId: row.fkClassId,
        date: row.date,
        fromStatus: from,
        toStatus: status,
        reason: text,
        source: "review",
        fkActorUserId: actor.id,
      },
      { transaction },
    );
    await auditService.record(
      actor,
      `changed attendance for student #${row.fkStudentId} on ${row.date} from ${from} to ${status}`,
      { entityType: "attendance", entityId: row.id, metadata: { studentId: row.fkStudentId, date: row.date, from, to: status, reason: text } },
      { transaction },
    );
    return { id: row.id, status, changeId: change.id };
  });
}

/**
 * Create a missing mark from the review page (decision 3). Reason required,
 * same window rules as edits (Super Admin exempt), one mark per student per day.
 */
async function create(actor, { studentId, classId, date, status, reason }) {
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const klass = await classOf(actor.schoolId, classId || student.fkClassId);
  if (classId && Number(student.fkClassId) !== Number(klass.id)) {
    throw new ApiError(400, "The student is not in this class.");
  }
  const { editWindowDays } = await rules(actor.schoolId);
  assertEditable(date, editWindowDays, schoolToday(), { bypass: bypassesWindow(actor) });
  if (await Attendances.count({ where: { fkStudentId: student.id, date } })) {
    throw new ApiError(409, "Attendance for this student on this date already exists. Edit it instead.");
  }
  const text = String(reason).trim();
  try {
    return await sequelize.transaction(async (transaction) => {
      const row = await Attendances.create(
        {
          fkSchoolId: actor.schoolId,
          fkStudentId: student.id,
          fkClassId: klass.id,
          date,
          status,
          fkMarkedByUserId: actor.id,
          fkCreatedByUserId: actor.id,
        },
        { transaction },
      );
      const change = await AttendanceChanges.create(
        {
          fkSchoolId: actor.schoolId,
          fkAttendanceId: row.id,
          fkStudentId: student.id,
          fkClassId: klass.id,
          date,
          fromStatus: null,
          toStatus: status,
          reason: text,
          source: "created",
          fkActorUserId: actor.id,
        },
        { transaction },
      );
      await auditService.record(
        actor,
        `created attendance for student #${student.id} on ${date} as ${status}`,
        { entityType: "attendance", entityId: row.id, metadata: { studentId: student.id, classId: klass.id, date, to: status, reason: text } },
        { transaction },
      );
      return { id: row.id, status, changeId: change.id, createdAt: row.get("created_at") };
    });
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw new ApiError(409, "Attendance for this student on this date already exists. Edit it instead.");
    }
    throw error;
  }
}

// ---- monthly / low attendance -----------------------------------------------------

function monthRange(month) {
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  return { start, end: iso(end) };
}

async function monthRows(schoolId, { month, classId }) {
  const { start, end } = monthRange(month);
  return sequelize.query(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.admission_no, s.status AS student_status,
            c.id AS class_id, c.label AS class_label,
            COUNT(a.id) FILTER (WHERE a.status = 'Present')::int AS present,
            COUNT(a.id) FILTER (WHERE a.status = 'Absent')::int AS absent,
            COUNT(a.id) FILTER (WHERE a.status = 'Late')::int AS late,
            COUNT(a.id) FILTER (WHERE a.status = 'Leave')::int AS leave,
            COUNT(a.id)::int AS marked
       FROM students s
       LEFT JOIN attendances a ON a.fk_student_id = s.id AND a.archived_at IS NULL AND a.date BETWEEN :start AND :end
            ${classId ? "AND a.fk_class_id = :classId" : ""}
       JOIN classes c ON c.id = COALESCE(${classId ? ":classId" : "a.fk_class_id, s.fk_class_id"})
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        AND (${classId ? "(s.fk_class_id = :classId AND s.status = 'Active') OR a.id IS NOT NULL" : "s.status = 'Active' OR a.id IS NOT NULL"})
      GROUP BY s.id, c.id
      ORDER BY s.first_name, s.last_name, s.id`,
    { replacements: { schoolId, start, end, classId: classId ? Number(classId) : null }, type: QueryTypes.SELECT },
  );
}

const summarise = (r, threshold) => {
  const percent = attendancePercent(r);
  return {
    studentId: r.student_id,
    name: fullName(r),
    admissionNo: r.admission_no,
    classId: r.class_id,
    classLabel: r.class_label,
    present: r.present,
    absent: r.absent,
    late: r.late,
    leave: r.leave,
    marked: r.marked,
    percent,
    low: percent !== null && percent < threshold,
  };
};

async function monthly(schoolId, { classId, month }) {
  const klass = await classOf(schoolId, classId);
  const { lowThreshold } = await rules(schoolId);
  const { start, end } = monthRange(month);
  const [{ days }] = await sequelize.query(
    `SELECT COUNT(DISTINCT date)::int AS days FROM attendances
      WHERE fk_school_id = :schoolId AND fk_class_id = :classId AND archived_at IS NULL AND date BETWEEN :start AND :end`,
    { replacements: { schoolId, classId: klass.id, start, end }, type: QueryTypes.SELECT },
  );
  const students = (await monthRows(schoolId, { month, classId: klass.id })).map((r) => summarise(r, lowThreshold));
  const totals = students.reduce((t, s) => ({ present: t.present + s.present, late: t.late + s.late, absent: t.absent + s.absent }), { present: 0, late: 0, absent: 0 });
  return {
    classId: klass.id,
    classLabel: klass.label,
    month,
    workingDays: days,
    threshold: lowThreshold,
    classPercent: attendancePercent(totals),
    students,
  };
}

async function guardians(studentIds) {
  if (!studentIds.length) return {};
  const rows = await sequelize.query(
    `SELECT DISTINCT ON (sp.fk_student_id) sp.fk_student_id AS student_id, p.guardian_name, p.father_name,
            p.primary_contact_number AS phone, sp.relationship_type AS relation
       FROM student_parents sp JOIN parents p ON p.id = sp.fk_parent_id AND p.archived_at IS NULL
      WHERE sp.fk_student_id IN (:studentIds)
      ORDER BY sp.fk_student_id, sp.is_primary DESC, sp.id`,
    { replacements: { studentIds }, type: QueryTypes.SELECT },
  );
  const students = await Students.findAll({ where: { id: studentIds }, attributes: ["id", "emergencyContact"] });
  const fallback = Object.fromEntries(students.map((s) => [s.id, s.emergencyContact]));
  const out = Object.fromEntries(studentIds.map((id) => [id, fallback[id] ? { name: null, relation: null, phone: fallback[id] } : null]));
  for (const r of rows) {
    out[r.student_id] = { name: r.guardian_name || r.father_name || null, relation: r.relation || null, phone: r.phone || fallback[r.student_id] || null };
  }
  return out;
}

async function lowAttendance(schoolId, { month, classId, threshold }) {
  const { lowThreshold } = await rules(schoolId);
  const limit = Number(threshold) || lowThreshold;
  const students = (await monthRows(schoolId, { month, classId }))
    .map((r) => summarise(r, limit))
    .filter((s) => s.low)
    .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
  const contacts = await guardians(students.map((s) => s.studentId));
  return {
    month,
    threshold: limit,
    defaultThreshold: lowThreshold,
    students: students.map((s) => ({ ...s, guardian: contacts[s.studentId] })),
  };
}

// ---- absentees ----------------------------------------------------------------------

async function absentees(schoolId, { date, classId }) {
  const rows = await sequelize.query(
    `SELECT a.id AS attendance_id, a.status, s.id AS student_id, s.first_name, s.last_name, s.admission_no,
            c.id AS class_id, c.label AS class_label
       FROM attendances a
       JOIN students s ON s.id = a.fk_student_id
       JOIN classes c ON c.id = a.fk_class_id
      WHERE a.fk_school_id = :schoolId AND a.date = :date AND a.archived_at IS NULL
        AND a.status IN ('Absent','Late') ${classId ? "AND a.fk_class_id = :classId" : ""}
      ORDER BY c.id, a.status, s.first_name, s.last_name`,
    { replacements: { schoolId, date, classId: classId ? Number(classId) : null }, type: QueryTypes.SELECT },
  );
  const contacts = await guardians([...new Set(rows.map((r) => r.student_id))]);
  const students = rows.map((r) => ({
    attendanceId: r.attendance_id,
    studentId: r.student_id,
    name: fullName(r),
    admissionNo: r.admission_no,
    classId: r.class_id,
    classLabel: r.class_label,
    status: r.status,
    guardian: contacts[r.student_id],
  }));
  return {
    date,
    absent: students.filter((s) => s.status === "Absent").length,
    late: students.filter((s) => s.status === "Late").length,
    students,
  };
}

// ---- change history ------------------------------------------------------------------

async function history(schoolId, filters = {}) {
  const size = Math.min(Math.max(Number(filters.pageSize) || 20, 1), 200);
  const page = Math.max(Number(filters.page) || 1, 1);
  const where = ["ch.fk_school_id = :schoolId"];
  const replacements = { schoolId, limit: size, offset: (page - 1) * size };
  if (filters.classId) { where.push("ch.fk_class_id = :classId"); replacements.classId = Number(filters.classId); }
  if (filters.studentId) { where.push("ch.fk_student_id = :studentId"); replacements.studentId = Number(filters.studentId); }
  if (filters.from) { where.push("ch.date >= :from"); replacements.from = filters.from; }
  if (filters.to) { where.push("ch.date <= :to"); replacements.to = filters.to; }
  if (String(filters.q || "").trim()) {
    where.push("(s.first_name || ' ' || s.last_name ILIKE :q OR s.admission_no ILIKE :q)");
    replacements.q = `%${String(filters.q).trim()}%`;
  }
  const base = `FROM attendance_changes ch
       JOIN students s ON s.id = ch.fk_student_id
       LEFT JOIN classes c ON c.id = ch.fk_class_id
       LEFT JOIN users u ON u.id = ch.fk_actor_user_id
      WHERE ${where.join(" AND ")}`;
  const [{ total }] = await sequelize.query(`SELECT COUNT(*)::int AS total ${base}`, { replacements, type: QueryTypes.SELECT });
  const rows = await sequelize.query(
    `SELECT ch.id, ch.date, ch.from_status, ch.to_status, ch.reason, ch.source, ch.created_at,
            s.id AS student_id, s.first_name, s.last_name, s.admission_no, c.id AS class_id, c.label AS class_label,
            u.first_name AS actor_first, u.last_name AS actor_last, u.role AS actor_role
       ${base}
      ORDER BY ch.created_at DESC, ch.id DESC LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  );
  return {
    page,
    pageSize: size,
    total,
    changes: rows.map((r) => ({
      id: r.id,
      date: r.date,
      from: r.from_status,
      to: r.to_status,
      reason: r.reason,
      source: r.source,
      changedAt: r.created_at,
      studentId: r.student_id,
      studentName: fullName(r),
      admissionNo: r.admission_no,
      classId: r.class_id,
      classLabel: r.class_label,
      actor: r.actor_first ? { name: [r.actor_first, r.actor_last].filter(Boolean).join(" "), role: r.actor_role } : null,
    })),
  };
}

// ---- reminders -------------------------------------------------------------------------

async function remind(actor, { classId, date = schoolToday() }) {
  if (date !== schoolToday()) throw new ApiError(400, "Reminders can only be sent for today's attendance.");
  const klass = await classOf(actor.schoolId, classId);
  if (klass.status !== "Active") throw new ApiError(409, "This class is not active.");
  if (await Attendances.count({ where: { fkSchoolId: actor.schoolId, fkClassId: klass.id, date } })) {
    throw new ApiError(409, "Attendance for this class has already been taken today.");
  }
  const resp = (await superMasterService.responsibility(actor.schoolId, [klass.id], date))[klass.id];
  if (resp.state === "unassigned") throw new ApiError(409, "This class has no Super Master yet. Assign one before sending a reminder.");
  if (resp.state === "inactive") throw new ApiError(409, "This class's Super Master is no longer active. Assign a new one before sending a reminder.");
  const teacher = resp.recipients[0];
  const [reminder, created] = await AttendanceReminders.findOrCreate({
    where: { fkClassId: klass.id, date },
    defaults: { fkSchoolId: actor.schoolId, fkTeacherUserId: teacher.userId, fkSentByUserId: actor.id },
  });
  if (!created) throw new ApiError(409, "A reminder was already sent for this class today.");
  await auditService.record(actor, `sent attendance reminder for ${klass.label} on ${date}`, {
    entityType: "attendance_reminder",
    entityId: reminder.id,
    metadata: { classId: klass.id, date, teacherUserIds: resp.recipients.map((r) => r.userId), viaSubstitute: resp.substitutes.length > 0 },
  });
  return {
    id: reminder.id,
    classId: klass.id,
    date,
    teacher: resp.recipients.map((r) => r.name).join(", "),
    viaSubstitute: resp.substitutes.length > 0,
    superMaster: resp.superMaster.name,
    sentAt: reminder.get("created_at"),
  };
}

module.exports = {
  ATTENDED,
  rules,
  editableUntil,
  assertEditable,
  todayStatus,
  daily,
  edit,
  create,
  monthly,
  lowAttendance,
  absentees,
  history,
  remind,
};
