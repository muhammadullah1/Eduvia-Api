"use strict";

/**
 * Management and student reports (SRS 8): student list, admission trend,
 * class distribution, and status / promotion records. Each builder returns the
 * same { title, filename, meta, columns, rows, summary } shape as the fee
 * reports, so `report_export` renders CSV, XLSX and PDF from the same rows the
 * screen shows. The route limits these to `students.manage` (Super Admin and
 * Operations); fee and finance figures stay in their own reports.
 */
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");
const { STUDENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const { today, firstOfMonth, addMonths } = require("../utils/dates");
const { classLabel, fullName, day, monthLabel } = require("./fee_report.service");

const STUDENT_REPORT_KINDS = ["students", "admissions", "class-distribution", "status-changes", "promotions"];
const STATUS_LABEL = { StruckOff: "Struck off" };
const statusLabel = (status) => STATUS_LABEL[status] || status;
const TREND_MONTHS = 12;
const PERCENT = 100;

const query = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** Inclusive date range; defaults to the last twelve months. */
function range({ from, to }) {
  const end = to || today();
  const start = from || addMonths(firstOfMonth(end), 1 - TREND_MONTHS);
  if (end < start) throw new ApiError(400, "The end date must be on or after the start date.");
  return { start, end, label: `${start} to ${end}` };
}

async function students(actor, { classId, status }) {
  const rows = (await query(
    `SELECT s.admission_no, s.first_name, s.last_name, s.gender, s.date_of_birth, s.admission_date, s.status,
            c.label AS class_label, p.guardian_name, p.father_name, p.primary_contact_number
       FROM students s
       LEFT JOIN classes c ON c.id = s.fk_class_id
       LEFT JOIN LATERAL (
         SELECT pa.guardian_name, pa.father_name, pa.primary_contact_number
           FROM student_parents sp JOIN parents pa ON pa.id = sp.fk_parent_id
          WHERE sp.fk_student_id = s.id
          ORDER BY sp.is_primary DESC, sp.id LIMIT 1) p ON true
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        ${classId ? "AND s.fk_class_id = :classId" : ""}
        ${status ? "AND s.status = :status" : ""}
      ORDER BY c.grade NULLS LAST, c.section NULLS LAST, s.first_name, s.last_name`,
    { schoolId: actor.schoolId, classId: classId || null, status: status || null },
  )).map((r) => ({
    admissionNo: r.admission_no,
    student: fullName(r.first_name, r.last_name),
    className: r.class_label || "",
    gender: r.gender || "",
    dateOfBirth: day(r.date_of_birth),
    admissionDate: day(r.admission_date),
    guardian: r.guardian_name || r.father_name || "",
    contact: r.primary_contact_number || "",
    status: statusLabel(r.status),
  }));
  return {
    kind: "students",
    title: "Student list",
    filename: `student-list-${today()}`,
    filters: { classId: classId || null, status: status || null },
    meta: [
      ["Class", await classLabel(actor, classId)],
      ["Status", status ? statusLabel(status) : "All statuses"],
    ],
    columns: [
      { key: "admissionNo", label: "Admission no", width: 0.11 },
      { key: "student", label: "Student", width: 0.16 },
      { key: "className", label: "Class", width: 0.08 },
      { key: "gender", label: "Gender", width: 0.07 },
      { key: "dateOfBirth", label: "Date of birth", width: 0.1 },
      { key: "admissionDate", label: "Admitted", width: 0.1 },
      { key: "guardian", label: "Guardian", width: 0.15 },
      { key: "contact", label: "Contact", width: 0.12 },
      { key: "status", label: "Status", width: 0.11 },
    ],
    rows,
    summary: [
      ["Students", rows.length],
      ["Boys", rows.filter((r) => r.gender === "Male").length],
      ["Girls", rows.filter((r) => r.gender === "Female").length],
    ],
  };
}

async function admissions(actor, filters) {
  const { start, end, label } = range(filters);
  const counts = await query(
    `SELECT to_char(s.admission_date, 'YYYY-MM') AS month, count(*)::int AS total,
            count(*) FILTER (WHERE s.gender = 'Male')::int AS boys,
            count(*) FILTER (WHERE s.gender = 'Female')::int AS girls
       FROM students s
      WHERE s.fk_school_id = :schoolId AND s.archived_at IS NULL
        AND s.admission_date BETWEEN :start AND :end
        ${filters.classId ? "AND s.fk_class_id = :classId" : ""}
      GROUP BY 1`,
    { schoolId: actor.schoolId, start, end, classId: filters.classId || null },
  );
  const byMonth = new Map(counts.map((r) => [r.month, r]));
  const rows = [];
  for (let month = firstOfMonth(start).slice(0, 7); month <= end.slice(0, 7); month = addMonths(`${month}-01`, 1).slice(0, 7)) {
    const hit = byMonth.get(month) || { total: 0, boys: 0, girls: 0 };
    rows.push({ month: monthLabel(month), admissions: hit.total, boys: hit.boys, girls: hit.girls });
  }
  const total = rows.reduce((n, r) => n + r.admissions, 0);
  return {
    kind: "admissions",
    title: "Admission trend",
    filename: `admission-trend-${start}-to-${end}`,
    filters: { from: start, to: end, classId: filters.classId || null },
    meta: [["Period", label], ["Class", await classLabel(actor, filters.classId)]],
    columns: [
      { key: "month", label: "Month", width: 0.4 },
      { key: "admissions", label: "Admissions", type: "number", width: 0.2 },
      { key: "boys", label: "Boys", type: "number", width: 0.2 },
      { key: "girls", label: "Girls", type: "number", width: 0.2 },
    ],
    rows,
    summary: [
      ["Admissions", total],
      ["Boys", rows.reduce((n, r) => n + r.boys, 0)],
      ["Girls", rows.reduce((n, r) => n + r.girls, 0)],
    ],
  };
}

async function classDistribution(actor) {
  const rows = (await query(
    `SELECT c.label, c.capacity,
            count(s.id) FILTER (WHERE s.status = :active)::int AS active,
            count(s.id) FILTER (WHERE s.status = :active AND s.gender = 'Male')::int AS boys,
            count(s.id) FILTER (WHERE s.status = :active AND s.gender = 'Female')::int AS girls,
            count(s.id) FILTER (WHERE s.status <> :active)::int AS other
       FROM classes c
       JOIN academic_sessions a ON a.id = c.fk_session_id AND a.is_current
       LEFT JOIN students s ON s.fk_class_id = c.id AND s.archived_at IS NULL
      WHERE c.fk_school_id = :schoolId AND c.archived_at IS NULL
      GROUP BY c.id
      ORDER BY c.grade, c.section`,
    { schoolId: actor.schoolId, active: STUDENT_STATUS.ACTIVE },
  )).map((r) => {
    let fill = null;
    if (r.capacity) fill = Math.round((r.active / r.capacity) * PERCENT);
    return { className: r.label, capacity: r.capacity, active: r.active, boys: r.boys, girls: r.girls, other: r.other, fill };
  });
  const active = rows.reduce((n, r) => n + r.active, 0);
  const capacity = rows.reduce((n, r) => n + (r.capacity || 0), 0);
  let fill = "—";
  if (capacity) fill = `${Math.round((active / capacity) * PERCENT)}%`;
  return {
    kind: "class-distribution",
    title: "Class distribution",
    filename: `class-distribution-${today()}`,
    filters: {},
    meta: [["Session", "Current session"], ["As of", today()]],
    columns: [
      { key: "className", label: "Class", width: 0.2 },
      { key: "active", label: "Active", type: "number", width: 0.14 },
      { key: "boys", label: "Boys", type: "number", width: 0.13 },
      { key: "girls", label: "Girls", type: "number", width: 0.13 },
      { key: "other", label: "Not active", type: "number", width: 0.14 },
      { key: "capacity", label: "Capacity", type: "number", width: 0.13 },
      { key: "fill", label: "Filled", type: "percent", width: 0.13 },
    ],
    rows,
    summary: [["Classes", rows.length], ["Active students", active], ["Seats", capacity], ["Filled", fill]],
  };
}

async function statusChanges(actor, filters) {
  const { start, end, label } = range(filters);
  const rows = (await query(
    `SELECT e.effective_on, e.event_type, e.from_status, e.to_status, e.reason, e.reason_category,
            s.admission_no, s.first_name, s.last_name, c.label AS class_label,
            u.first_name AS by_first, u.last_name AS by_last
       FROM student_status_events e
       JOIN students s ON s.id = e.fk_student_id
       LEFT JOIN classes c ON c.id = e.fk_class_id
       LEFT JOIN users u ON u.id = e.fk_actor_user_id
      WHERE e.fk_school_id = :schoolId AND e.effective_on BETWEEN :start AND :end
        ${filters.classId ? "AND e.fk_class_id = :classId" : ""}
      ORDER BY e.effective_on, e.id`,
    { schoolId: actor.schoolId, start, end, classId: filters.classId || null },
  )).map((r) => ({
    date: day(r.effective_on),
    admissionNo: r.admission_no,
    student: fullName(r.first_name, r.last_name),
    className: r.class_label || "",
    event: statusLabel(r.event_type),
    change: `${statusLabel(r.from_status)} → ${statusLabel(r.to_status)}`,
    reason: [r.reason_category, r.reason].filter(Boolean).join(": "),
    recordedBy: fullName(r.by_first, r.by_last),
  }));
  const byEvent = new Map();
  rows.forEach((r) => byEvent.set(r.event, (byEvent.get(r.event) || 0) + 1));
  return {
    kind: "status-changes",
    title: "Student status records",
    filename: `status-records-${start}-to-${end}`,
    filters: { from: start, to: end, classId: filters.classId || null },
    meta: [["Period", label], ["Class", await classLabel(actor, filters.classId)]],
    columns: [
      { key: "date", label: "Date", width: 0.09 },
      { key: "admissionNo", label: "Admission no", width: 0.11 },
      { key: "student", label: "Student", width: 0.15 },
      { key: "className", label: "Class", width: 0.08 },
      { key: "event", label: "Event", width: 0.1 },
      { key: "change", label: "Status", width: 0.14 },
      { key: "reason", label: "Reason", width: 0.21 },
      { key: "recordedBy", label: "Recorded by", width: 0.12 },
    ],
    rows,
    summary: [["Records", rows.length], ...[...byEvent.entries()].map(([event, count]) => [event, count])],
  };
}

async function promotions(actor, filters) {
  const { start, end, label } = range(filters);
  const rows = (await query(
    `SELECT p.promoted_on, p.outcome, s.admission_no, s.first_name, s.last_name,
            fc.label AS from_label, tc.label AS to_label, a.name AS session_name
       FROM student_promotions p
       JOIN students s ON s.id = p.fk_student_id
       LEFT JOIN classes fc ON fc.id = p.fk_from_class_id
       LEFT JOIN classes tc ON tc.id = p.fk_to_class_id
       LEFT JOIN academic_sessions a ON a.id = p.fk_session_id
      WHERE p.fk_school_id = :schoolId AND p.promoted_on BETWEEN :start AND :end
        ${filters.classId ? "AND (p.fk_from_class_id = :classId OR p.fk_to_class_id = :classId)" : ""}
      ORDER BY p.promoted_on, p.id`,
    { schoolId: actor.schoolId, start, end, classId: filters.classId || null },
  )).map((r) => ({
    date: day(r.promoted_on),
    admissionNo: r.admission_no,
    student: fullName(r.first_name, r.last_name),
    fromClass: r.from_label || "",
    toClass: r.to_label || "",
    outcome: r.outcome,
    session: r.session_name || "",
  }));
  const byOutcome = new Map();
  rows.forEach((r) => byOutcome.set(r.outcome, (byOutcome.get(r.outcome) || 0) + 1));
  return {
    kind: "promotions",
    title: "Promotion records",
    filename: `promotion-records-${start}-to-${end}`,
    filters: { from: start, to: end, classId: filters.classId || null },
    meta: [["Period", label], ["Class", await classLabel(actor, filters.classId)]],
    columns: [
      { key: "date", label: "Date", width: 0.12 },
      { key: "admissionNo", label: "Admission no", width: 0.14 },
      { key: "student", label: "Student", width: 0.2 },
      { key: "fromClass", label: "From class", width: 0.13 },
      { key: "toClass", label: "To class", width: 0.13 },
      { key: "outcome", label: "Outcome", width: 0.13 },
      { key: "session", label: "Session", width: 0.15 },
    ],
    rows,
    summary: [["Records", rows.length], ...[...byOutcome.entries()].map(([outcome, count]) => [outcome, count])],
  };
}

const BUILDERS = {
  students,
  admissions,
  "class-distribution": classDistribution,
  "status-changes": statusChanges,
  promotions,
};

async function build(actor, kind, filters = {}) {
  if (!BUILDERS[kind]) throw new ApiError(404, "Unknown report.");
  return BUILDERS[kind](actor, filters);
}

module.exports = { STUDENT_REPORT_KINDS, build };
