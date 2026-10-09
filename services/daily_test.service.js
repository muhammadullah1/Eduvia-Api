"use strict";

const { Op } = require("sequelize");
const {
  DailyTestSchedules,
  DailyTests,
  DailyTestResults,
  MonthlyStudentSummaries,
  Students,
  Subjects,
  Classes,
  TimetableSlots,
  sequelize,
} = require("../models");
const { USER_ROLES, DAILY_TEST_STATUS, SETTING_KEYS, STUDENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const { datesForWeekday, weekOfMonth, monthKey } = require("../utils/dates");
const { summarizeMonth, isPassedScore } = require("../utils/monthly_status");

/**
 * Weekly subject tests (UR-05/06, BR-06/07/08). Management fixes one test day
 * per class+subject; tests for a month are generated from that schedule;
 * teachers enter marks; parents see marks only once a test is published.
 */

const scheduleInclude = [
  { model: Classes, as: "class", attributes: ["id", "label"] },
  { model: Subjects, as: "subject", attributes: ["id", "name"] },
];

// ---- schedules -------------------------------------------------------------

async function listSchedules(schoolId, { classId, subjectId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (subjectId) where.fkSubjectId = subjectId;
  return DailyTestSchedules.findAll({ where, include: scheduleInclude, order: [["fkClassId", "ASC"], ["fkSubjectId", "ASC"]] });
}

async function saveSchedule(actor, { classId, subjectId, weekday, periodIndex, maxScore }) {
  const [klass, subject] = await Promise.all([
    Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId } }),
    Subjects.findOne({ where: { id: subjectId, fkSchoolId: actor.schoolId } }),
  ]);
  if (!klass || !subject) throw new ApiError(404, "Class or subject not found");
  if (periodIndex && periodIndex > klass.periodCount) throw new ApiError(400, `${klass.label} only has ${klass.periodCount} periods.`);
  const values = { weekday, periodIndex: periodIndex || null, maxScore: maxScore || 20, fkCreatedByUserId: actor.id };
  const existing = await DailyTestSchedules.findOne({ where: { fkClassId: klass.id, fkSubjectId: subject.id, isActive: true } });
  const row = existing
    ? await existing.update(values)
    : await DailyTestSchedules.create({ ...values, fkSchoolId: actor.schoolId, fkClassId: klass.id, fkSubjectId: subject.id });
  await auditService.record(actor, `set weekly ${subject.name} test for ${klass.label} on ${weekday}`, {
    entityType: "daily_test_schedule",
    entityId: row.id,
  });
  return row;
}

async function deactivateSchedule(actor, id) {
  const row = await DailyTestSchedules.findOne({ where: { id, fkSchoolId: actor.schoolId } });
  if (!row) throw new ApiError(404, "Schedule not found");
  await row.update({ isActive: false });
  return row;
}

/** Create the month's dated tests from every active schedule (idempotent). */
async function generateMonth(actor, { month, classId }) {
  const schedules = await listSchedules(actor.schoolId, { classId });
  const created = [];
  for (const schedule of schedules) {
    const slot = await TimetableSlots.findOne({
      where: {
        fkClassId: schedule.fkClassId,
        fkSubjectId: schedule.fkSubjectId,
        day: schedule.weekday,
        ...(schedule.periodIndex && { periodIndex: schedule.periodIndex }),
      },
    });
    for (const date of datesForWeekday(month, schedule.weekday)) {
      const [test, isNew] = await DailyTests.findOrCreate({
        where: { fkClassId: schedule.fkClassId, fkSubjectId: schedule.fkSubjectId, date },
        defaults: {
          fkSchoolId: actor.schoolId,
          fkScheduleId: schedule.id,
          fkTeacherId: slot ? slot.fkTeacherId : null,
          month,
          weekOfMonth: weekOfMonth(date),
          periodIndex: schedule.periodIndex || (slot ? slot.periodIndex : null),
          title: `${schedule.subject.name} weekly test · week ${weekOfMonth(date)}`,
          maxScore: schedule.maxScore,
          status: DAILY_TEST_STATUS.SCHEDULED,
        },
      });
      if (isNew) created.push(test);
    }
    await recompute(actor, { classId: schedule.fkClassId, subjectId: schedule.fkSubjectId, month });
  }
  return created;
}

// ---- tests & marks ---------------------------------------------------------

async function scopeWhere(user, filters) {
  const where = { fkSchoolId: user.schoolId };
  if (filters.classId) where.fkClassId = filters.classId;
  if (filters.subjectId) where.fkSubjectId = filters.subjectId;
  if (user.role === USER_ROLES.TEACHER) {
    const teacher = await accessService.teacherFor(user);
    where.fkSubjectId = teacher.fkSubjectId;
    where.fkClassId = filters.classId || { [Op.in]: await accessService.teacherClassIds(teacher) };
  }
  return where;
}

async function list(user, filters = {}) {
  let studentFilter;
  if (user.role === USER_ROLES.PARENT) {
    const studentIds = await accessService.linkedStudentIds(user);
    if (filters.studentId) {
      const student = await accessService.assertStudentAccess(user, filters.studentId);
      filters = { ...filters, classId: student.fkClassId };
      studentFilter = { fkStudentId: student.id };
    } else if (!studentIds.length) {
      return [];
    } else {
      filters = { ...filters, classId: { [Op.in]: await accessService.linkedClassIds(user) } };
      studentFilter = { fkStudentId: { [Op.in]: studentIds } };
    }
  }
  return DailyTests.findAll({
    where: await scopeWhere(user, filters),
    include: [
      ...scheduleInclude,
      { model: DailyTestResults, as: "results", required: false, where: studentFilter, attributes: ["fkStudentId", "obtainedMarks"] },
    ],
    order: [["date", "ASC"]],
  });
}

async function getForStaff(user, id) {
  const test = await DailyTests.findOne({
    where: { ...(await scopeWhere(user, {})), id },
    include: [...scheduleInclude, { model: DailyTestResults, as: "results" }],
  });
  if (!test) throw new ApiError(404, "Test not found");
  return test;
}

async function saveMarks(user, id, marks) {
  const test = await getForStaff(user, id);
  if (test.status === DAILY_TEST_STATUS.PUBLISHED) throw new ApiError(400, "Published marks are locked.");
  await accessService.assertTeacherCanTeach(user, { classId: test.fkClassId, subjectId: test.fkSubjectId, date: test.date });
  const students = await Students.findAll({ where: { fkClassId: test.fkClassId, fkSchoolId: user.schoolId }, attributes: ["id"] });
  const inClass = new Set(students.map((s) => s.id));
  for (const mark of marks) {
    if (!inClass.has(mark.studentId)) throw new ApiError(400, `Student ${mark.studentId} is not in this class.`);
    if (mark.score != null && (mark.score < 0 || mark.score > Number(test.maxScore))) {
      throw new ApiError(400, `Scores must be between 0 and ${Number(test.maxScore)}.`);
    }
  }
  await sequelize.transaction(async (transaction) => {
    for (const mark of marks) {
      const [row] = await DailyTestResults.findOrCreate({
        where: { fkDailyTestId: test.id, fkStudentId: mark.studentId },
        defaults: { score: mark.score, fkEnteredByUserId: user.id },
        transaction,
      });
      await row.update({ score: mark.score, fkEnteredByUserId: user.id }, { transaction });
    }
    await test.update({ status: DAILY_TEST_STATUS.MARKS_ENTERED }, { transaction });
  });
  await recompute(user, { classId: test.fkClassId, subjectId: test.fkSubjectId, month: test.month });
  return getForStaff(user, id);
}

async function publish(actor, id) {
  const test = await getForStaff(actor, id);
  if (test.status !== DAILY_TEST_STATUS.MARKS_ENTERED) throw new ApiError(400, "Enter marks before publishing.");
  await test.update({ status: DAILY_TEST_STATUS.PUBLISHED, publishedAt: new Date(), fkPublishedByUserId: actor.id });
  await auditService.record(actor, `published weekly test #${test.id}`, { entityType: "daily_test", entityId: test.id });
  return getForStaff(actor, id);
}

// ---- monthly outcome -------------------------------------------------------

/**
 * Recalculate the month's outcome for every student of a class+subject from
 * the entered weekly marks and the school's configurable rules. Outcome
 * changes are written to the audit trail.
 */
async function recompute(actor, { classId, subjectId, month }) {
  const rules = await settingsService.get(actor.schoolId, SETTING_KEYS.DAILY_TEST_RULES);
  const tests = await DailyTests.findAll({
    where: { fkSchoolId: actor.schoolId, fkClassId: classId, fkSubjectId: subjectId, month },
    include: [{ model: DailyTestResults, as: "results" }],
  });
  const students = await Students.findAll({
    where: { fkSchoolId: actor.schoolId, fkClassId: classId, status: STUDENT_STATUS.ACTIVE },
    attributes: ["id"],
  });
  for (const student of students) {
    const marks = tests.flatMap((t) =>
      t.results.filter((r) => r.fkStudentId === student.id).map((r) => ({ score: r.score, maxScore: t.maxScore })),
    );
    const outcome = summarizeMonth(marks, tests.length, rules);
    const key = { fkStudentId: student.id, fkClassId: classId, fkSubjectId: subjectId, month };
    const existing = await MonthlyStudentSummaries.findOne({ where: key });
    const before = existing ? existing.status : null;
    const row = existing
      ? await existing.update(outcome)
      : await MonthlyStudentSummaries.create({ ...key, ...outcome, fkSchoolId: actor.schoolId });
    if (before !== outcome.status && (existing || outcome.testsTaken > 0)) {
      await auditService.record(actor, `weekly-test outcome for student #${student.id} (${month}) is ${outcome.status}`, {
        entityType: "monthly_student_summary",
        entityId: row.id,
        metadata: { ...key, from: before, ...outcome },
      });
    }
  }
}

/** Re-apply rules after management changes pass criteria. */
async function recomputeAll(actor) {
  const combos = await DailyTests.findAll({
    where: { fkSchoolId: actor.schoolId },
    attributes: ["fkClassId", "fkSubjectId", "month"],
    group: ["fkClassId", "fkSubjectId", "month"],
    raw: true,
  });
  for (const c of combos) await recompute(actor, { classId: c.fkClassId, subjectId: c.fkSubjectId, month: c.month });
}

/**
 * Monthly subject summary (§7): the month's weekly tests side by side with
 * each student's outcome. Parents get their child only, computed from
 * published tests so unpublished marks never leak.
 */
async function monthlySummary(user, { classId, subjectId, month, studentId }) {
  const rules = await settingsService.get(user.schoolId, SETTING_KEYS.DAILY_TEST_RULES);
  if (user.role === USER_ROLES.PARENT) {
    const student = await accessService.assertStudentAccess(user, studentId);
    const tests = await list(user, { studentId: student.id, month, subjectId });
    const bySubject = new Map();
    for (const t of tests) {
      if (!bySubject.has(t.fkSubjectId)) bySubject.set(t.fkSubjectId, { subject: t.subject, tests: [] });
      const result = t.results[0];
      bySubject.get(t.fkSubjectId).tests.push({
        id: t.id,
        date: t.date,
        weekOfMonth: t.weekOfMonth,
        maxScore: Number(t.maxScore),
        score: result && result.score != null ? Number(result.score) : null,
        passed: result ? isPassedScore(result.score, t.maxScore, rules.passPercent) : null,
      });
    }
    return [...bySubject.values()].map((entry) => ({
      ...entry,
      outcome: summarizeMonth(entry.tests, entry.tests.length, rules),
    }));
  }

  if (!classId || !subjectId || !month) throw new ApiError(400, "classId, subjectId and month are required");
  const tests = await list(user, { classId, subjectId, month });
  const where = { fkSchoolId: user.schoolId, fkClassId: classId, fkSubjectId: subjectId, month };
  if (studentId) where.fkStudentId = studentId;
  const [summaries, students] = await Promise.all([
    MonthlyStudentSummaries.findAll({ where }),
    Students.findAll({ where: { fkClassId: classId, fkSchoolId: user.schoolId }, attributes: ["id", "firstName", "lastName", "admissionNo"] }),
  ]);
  const byStudent = new Map(summaries.map((s) => [s.fkStudentId, s]));
  return {
    rules,
    tests: tests.map((t) => ({ id: t.id, date: t.date, weekOfMonth: t.weekOfMonth, status: t.status, maxScore: Number(t.maxScore) })),
    students: students.map((s) => ({
      student: s,
      scores: tests.map((t) => {
        const r = t.results.find((x) => x.fkStudentId === s.id);
        return r && r.score != null ? Number(r.score) : null;
      }),
      summary: byStudent.get(s.id) || null,
    })),
  };
}

async function flagged(user, { month }) {
  return MonthlyStudentSummaries.findAll({
    where: { fkSchoolId: user.schoolId, month: month || monthKey(new Date().toISOString()), flaggedForFollowUp: true },
    include: [
      { model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] },
      { model: Subjects, as: "subject", attributes: ["id", "name"] },
      { model: Classes, as: "class", attributes: ["id", "label"] },
    ],
  });
}

module.exports = {
  listSchedules,
  saveSchedule,
  deactivateSchedule,
  generateMonth,
  list,
  getForStaff,
  saveMarks,
  publish,
  recompute,
  recomputeAll,
  monthlySummary,
  flagged,
};
