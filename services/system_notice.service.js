"use strict";

/**
 * Actionable "something needs doing" notices for the portal Help popover.
 * Each check is independent: add one by appending to CHECKS. A check returns
 * null when there is nothing to do, so the popover only lists real work.
 */
const { Op } = require("sequelize");
const { Exams, MarkSheets, Attendances, Classes, TeacherAbsences, BlockDates } = require("../models");
const { USER_ROLES } = require("../constants");
const { today: schoolToday, weekdayOf } = require("../utils/dates");
const superMasterService = require("./super_master.service");

const MANAGERS = [USER_ROLES.SUPER_ADMIN, USER_ROLES.OPERATIONS_MANAGER];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function unscheduledPapers({ schoolId }) {
  const count = await MarkSheets.count({
    where: { fkSchoolId: schoolId, paperDate: null },
    include: [{ model: Exams, as: "exam", required: true, where: { status: { [Op.in]: ["Draft", "Scheduled"] } } }],
  });
  if (!count) return null;
  return {
    id: "exam-papers-unscheduled",
    title: "Exam papers without a date",
    detail: `${plural(count, "paper")} in upcoming exams still need a date.`,
    count,
    section: "exams",
  };
}

async function isSchoolDay(schoolId, date) {
  if (weekdayOf(date) === "Sunday") return false;
  const blocked = await BlockDates.count({
    where: { fkSchoolId: schoolId, startDate: { [Op.lte]: date }, endDate: { [Op.gte]: date } },
  });
  return blocked === 0;
}

async function attendanceNotMarked({ schoolId, today }) {
  // Only once the school actually uses attendance.
  if (!(await Attendances.count({ where: { fkSchoolId: schoolId }, limit: 1 }))) return null;
  if (!(await isSchoolDay(schoolId, today))) return null;
  const activeClasses = await Classes.findAll({ where: { fkSchoolId: schoolId, status: "Active" }, attributes: ["id"], raw: true });
  if (!activeClasses.length) return null;
  const ids = activeClasses.map((row) => row.id);
  const marked = await Attendances.findAll({
    where: { fkSchoolId: schoolId, date: today, fkClassId: { [Op.in]: ids } },
    attributes: ["fkClassId"],
    group: ["fkClassId"],
    raw: true,
  });
  const missing = ids.length - marked.length;
  if (missing <= 0) return null;
  return {
    id: "attendance-not-marked",
    title: "Attendance not marked today",
    detail: `${plural(missing, "active class")} ${missing === 1 ? "has" : "have"} no attendance for today yet.`,
    count: missing,
    section: "student-attendance",
  };
}

async function pendingSubstitutions({ schoolId, today }) {
  const count = await TeacherAbsences.count({ where: { fkSchoolId: schoolId, status: "Pending", date: { [Op.gte]: today } } });
  if (!count) return null;
  return {
    id: "substitutions-pending",
    title: "Lessons need a substitute",
    detail: `${plural(count, "absent-teacher lesson")} from today on ${count === 1 ? "has" : "have"} no cover yet.`,
    count,
    section: "substitutes",
  };
}

async function attendanceReminders({ user, today }) {
  const rows = (await superMasterService.remindersFor(user, today)).filter((r) => !r.taken);
  if (!rows.length) return null;
  return {
    id: "attendance-reminder",
    title: "Attendance reminder",
    detail: `Management is waiting for today's attendance: ${rows.map((r) => r.classLabel).join(", ")}.`,
    count: rows.length,
    section: "attendance",
  };
}

const CHECKS = [
  { roles: MANAGERS, run: unscheduledPapers },
  { roles: MANAGERS, run: attendanceNotMarked },
  { roles: MANAGERS, run: pendingSubstitutions },
  { roles: [USER_ROLES.TEACHER], run: attendanceReminders },
];

async function list(user, { today = schoolToday(), checks = CHECKS } = {}) {
  const ctx = { schoolId: user.schoolId, today, user };
  const applicable = checks.filter((check) => check.roles.includes(user.role));
  const results = await Promise.all(applicable.map((check) => check.run(ctx)));
  return results.filter(Boolean);
}

module.exports = { list, CHECKS, isSchoolDay };
