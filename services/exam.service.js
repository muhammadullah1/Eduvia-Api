"use strict";

const {
  Exams,
  MarkSheets,
  MarkSheetRows,
  ResultVisibilityOverrides,
  Students,
  Subjects,
  Classes,
  TimetableSlots,
  Users,
  sequelize,
} = require("../models");
const { USER_ROLES, SHEET_STATUS, RESULT_FEE_RULES, SETTING_KEYS, STUDENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const feeService = require("./fee.service");
const { today, monthKey } = require("../utils/dates");

/**
 * Exams and results (UR-07, BR-09/10). Publication is a property of the mark
 * sheet; whether a parent can see it is decided at read time from the
 * school's fee rule and any active override. Neither step touches marks.
 */

const sheetInclude = [{ model: MarkSheetRows, as: "rows", include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }] }];

async function teacherScope(user) {
  if (user.role !== USER_ROLES.TEACHER) return null;
  const teacher = await accessService.teacherFor(user);
  return { teacher, classIds: await accessService.teacherClassIds(teacher) };
}

async function list(user, { classId } = {}) {
  const scope = await teacherScope(user);
  const sheetWhere = {};
  if (scope) {
    sheetWhere.fkSubjectId = scope.teacher.fkSubjectId;
    const allowed = classId ? scope.classIds.filter((id) => id === Number(classId)) : scope.classIds;
    sheetWhere.fkClassId = allowed.length ? allowed : [-1];
  } else if (classId) {
    sheetWhere.fkClassId = classId;
  }
  const exams = await Exams.findAll({
    where: { fkSchoolId: user.schoolId },
    include: [
      {
        model: MarkSheets,
        as: "markSheets",
        where: Object.keys(sheetWhere).length ? sheetWhere : undefined,
        required: false,
        include: [
          { model: Subjects, as: "subject", attributes: ["id", "name"] },
          { model: MarkSheetRows, as: "rows" },
        ],
      },
    ],
    order: [["id", "DESC"]],
  });
  if (user.role !== USER_ROLES.PARENT) return exams;
  const studentIds = new Set(await accessService.linkedStudentIds(user));
  return exams
    .map((exam) => {
      const plain = exam.get({ plain: true });
      plain.markSheets = (plain.markSheets || [])
        .filter((sheet) => sheet.status === "Published")
        .map((sheet) => ({ ...sheet, rows: (sheet.rows || []).filter((row) => studentIds.has(row.fkStudentId)) }))
        .filter((sheet) => sheet.rows.length);
      return plain;
    })
    .filter((exam) => exam.markSheets.length);
}

async function create(actor, { classId, name, feeMonth, sessionId, subjects }) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  const students = await Students.findAll({ where: { fkClassId: klass.id, status: STUDENT_STATUS.ACTIVE }, attributes: ["id"] });
  const examId = await sequelize.transaction(async (transaction) => {
    const exam = await Exams.create(
      { fkSchoolId: actor.schoolId, fkClassId: klass.id, fkSessionId: sessionId || klass.fkSessionId, name, feeMonth: feeMonth || null },
      { transaction },
    );
    for (const item of subjects) {
      const subject = await Subjects.findOne({ where: { id: item.subjectId, fkSchoolId: actor.schoolId }, transaction });
      if (!subject) throw new ApiError(404, `Subject ${item.subjectId} not found`);
      const slot = await TimetableSlots.findOne({ where: { fkClassId: klass.id, fkSubjectId: subject.id }, transaction });
      const sheet = await MarkSheets.create(
        {
          fkSchoolId: actor.schoolId,
          fkExamId: exam.id,
          examName: name,
          fkClassId: klass.id,
          fkSubjectId: subject.id,
          subject: subject.name,
          fkTeacherId: item.teacherId || (slot ? slot.fkTeacherId : null),
          maxScore: item.maxScore || 100,
          status: SHEET_STATUS.DRAFT,
        },
        { transaction },
      );
      await MarkSheetRows.bulkCreate(students.map((s) => ({ fkMarkSheetId: sheet.id, fkStudentId: s.id, score: null })), { transaction });
    }
    return exam.id;
  });
  return getExam(actor, examId);
}

async function getExam(user, id) {
  const [exam] = await list(user, {}).then((rows) => rows.filter((e) => e.id === Number(id)));
  if (!exam) throw new ApiError(404, "Exam not found");
  return exam;
}

async function getSheet(user, id) {
  const sheet = await MarkSheets.findOne({ where: { id, fkSchoolId: user.schoolId }, include: sheetInclude });
  if (!sheet) throw new ApiError(404, "Mark sheet not found");
  const scope = await teacherScope(user);
  if (scope && (sheet.fkSubjectId !== scope.teacher.fkSubjectId || !scope.classIds.includes(sheet.fkClassId))) {
    throw new ApiError(403, "You can only open mark sheets for your own subject and classes.");
  }
  return sheet;
}

async function updateRows(user, sheetId, rows) {
  const sheet = await getSheet(user, sheetId);
  if (sheet.status !== SHEET_STATUS.DRAFT) throw new ApiError(400, "Only draft sheets can be edited.");
  const max = Number(sheet.maxScore);
  const known = new Map(sheet.rows.map((r) => [r.fkStudentId, r]));
  for (const r of rows) {
    if (!known.has(r.studentId)) throw new ApiError(400, `Student ${r.studentId} is not on this sheet.`);
    if (r.score != null && (r.score < 0 || r.score > max)) throw new ApiError(400, `Scores must be between 0 and ${max}.`);
  }
  await sequelize.transaction(async (transaction) => {
    for (const r of rows) await known.get(r.studentId).update({ score: r.score ?? null }, { transaction });
  });
  return getSheet(user, sheetId);
}

const TRANSITIONS = {
  submit: [SHEET_STATUS.DRAFT, SHEET_STATUS.SUBMITTED],
  verify: [SHEET_STATUS.SUBMITTED, SHEET_STATUS.VERIFIED],
  publish: [SHEET_STATUS.VERIFIED, SHEET_STATUS.PUBLISHED],
};

async function transition(user, sheetId, action) {
  const sheet = await getSheet(user, sheetId);
  if (action === "reopen") {
    await sheet.update({ status: SHEET_STATUS.DRAFT, publishedAt: null, fkPublishedByUserId: null });
  } else {
    const [from, to] = TRANSITIONS[action];
    if (sheet.status !== from) throw new ApiError(400, `Only ${from.toLowerCase()} sheets can be ${to.toLowerCase()}.`);
    if (action === "submit" && sheet.rows.some((r) => r.score == null)) throw new ApiError(400, "Enter every score before submitting.");
    const extra = to === SHEET_STATUS.PUBLISHED ? { publishedAt: new Date(), fkPublishedByUserId: user.id } : {};
    await sheet.update({ status: to, ...extra });
  }
  await auditService.record(user, `${action} mark sheet #${sheet.id} (${sheet.subject}, ${sheet.examName})`, {
    entityType: "mark_sheet",
    entityId: sheet.id,
  });
  return getSheet(user, sheetId);
}

// ---- parent visibility -----------------------------------------------------

/** Apply the configured fee rule for one student and exam at read time. */
async function feeCleared(schoolId, exam, studentId, rule) {
  const month = exam.feeMonth || monthKey(today());
  if (rule === RESULT_FEE_RULES.DISABLED) return true;
  if (rule === RESULT_FEE_RULES.EXAM_MONTH_PAID) return feeService.isMonthPaid(schoolId, studentId, month);
  return feeService.isPaidThrough(schoolId, studentId, month);
}

async function activeOverride(examId, studentId) {
  return ResultVisibilityOverrides.findOne({ where: { fkExamId: examId, fkStudentId: studentId, revokedAt: null } });
}

async function visibility(schoolId, exam, studentId, rule) {
  const override = await activeOverride(exam.id, studentId);
  const cleared = await feeCleared(schoolId, exam, studentId, rule);
  return { feeCleared: cleared, overridden: Boolean(override), visible: cleared || Boolean(override), override };
}

/** Results for a parent's child: published sheets only, gated by fees. */
async function parentResults(user, studentId) {
  const student = await accessService.assertStudentAccess(user, studentId);
  const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const exams = await Exams.findAll({
    where: { fkSchoolId: user.schoolId, fkClassId: student.fkClassId },
    include: [{ model: MarkSheets, as: "sheets", where: { status: SHEET_STATUS.PUBLISHED }, required: true, include: [{ model: MarkSheetRows, as: "rows", where: { fkStudentId: student.id }, required: false }] }],
    order: [["id", "DESC"]],
  });
  const out = [];
  for (const exam of exams) {
    const gate = await visibility(user.schoolId, exam, student.id, feeRule);
    out.push({
      examId: exam.id,
      name: exam.name,
      feeMonth: exam.feeMonth,
      visible: gate.visible,
      withheldReason: gate.visible ? null : "Result withheld until fees are cleared. Please contact the school office.",
      subjects: gate.visible
        ? exam.sheets.map((s) => ({
            subject: s.subject,
            maxScore: Number(s.maxScore),
            score: s.rows[0] && s.rows[0].score != null ? Number(s.rows[0].score) : null,
            publishedAt: s.publishedAt,
          }))
        : [],
    });
  }
  return { student: { id: student.id, name: `${student.firstName} ${student.lastName}` }, exams: out };
}

/** Staff view of who can / cannot see an exam's results and why. */
async function gateStatus(user, examId) {
  const exam = await Exams.findOne({ where: { id: examId, fkSchoolId: user.schoolId }, include: [{ model: MarkSheets, as: "sheets", attributes: ["id", "status"] }] });
  if (!exam) throw new ApiError(404, "Exam not found");
  const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const students = await Students.findAll({ where: { fkClassId: exam.fkClassId, fkSchoolId: user.schoolId }, attributes: ["id", "firstName", "lastName", "admissionNo"], order: [["firstName", "ASC"]] });
  const published = exam.sheets.filter((s) => s.status === SHEET_STATUS.PUBLISHED).length;
  const rows = [];
  for (const s of students) {
    const gate = await visibility(user.schoolId, exam, s.id, feeRule);
    rows.push({
      student: s,
      feeCleared: gate.feeCleared,
      override: gate.override && { id: gate.override.id, reason: gate.override.reason, grantedAt: gate.override.grantedAt },
      visibleToParent: published > 0 && gate.visible,
    });
  }
  return { exam: { id: exam.id, name: exam.name, feeMonth: exam.feeMonth }, feeRule, publishedSheets: published, totalSheets: exam.sheets.length, rows };
}

async function grantOverride(actor, examId, { studentId, reason }) {
  const exam = await Exams.findOne({ where: { id: examId, fkSchoolId: actor.schoolId } });
  if (!exam) throw new ApiError(404, "Exam not found");
  const student = await Students.findOne({ where: { id: studentId, fkClassId: exam.fkClassId, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student is not in this exam's class");
  const { requireOverrideReason } = await settingsService.get(actor.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  if (requireOverrideReason && !String(reason || "").trim()) throw new ApiError(400, "A reason is required for an override.");
  if (await activeOverride(exam.id, student.id)) throw new ApiError(409, "An override is already active for this student.");
  const override = await ResultVisibilityOverrides.create({
    fkSchoolId: actor.schoolId,
    fkExamId: exam.id,
    fkStudentId: student.id,
    reason: String(reason || "").trim() || "—",
    fkGrantedByUserId: actor.id,
    grantedAt: new Date(),
  });
  await auditService.record(actor, `released ${exam.name} result for ${student.firstName} ${student.lastName} despite fees`, {
    entityType: "result_visibility_override",
    entityId: override.id,
    metadata: { examId: exam.id, studentId: student.id, reason: override.reason, grantedAt: override.grantedAt },
  });
  return override;
}

async function revokeOverride(actor, overrideId) {
  const override = await ResultVisibilityOverrides.findOne({ where: { id: overrideId, fkSchoolId: actor.schoolId, revokedAt: null } });
  if (!override) throw new ApiError(404, "Active override not found");
  await override.update({ revokedAt: new Date(), fkRevokedByUserId: actor.id });
  await auditService.record(actor, `revoked result override #${override.id}`, {
    entityType: "result_visibility_override",
    entityId: override.id,
    metadata: { examId: override.fkExamId, studentId: override.fkStudentId },
  });
  return override;
}

async function listOverrides(user, { examId } = {}) {
  const where = { fkSchoolId: user.schoolId };
  if (examId) where.fkExamId = examId;
  return ResultVisibilityOverrides.findAll({
    where,
    include: [
      { model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] },
      { model: Users, as: "grantedBy", attributes: ["id", "firstName", "lastName"] },
      { model: Exams, as: "exam", attributes: ["id", "name"] },
    ],
    order: [["grantedAt", "DESC"]],
  });
}

module.exports = {
  list,
  create,
  getExam,
  getSheet,
  updateRows,
  transition,
  parentResults,
  gateStatus,
  grantOverride,
  revokeOverride,
  listOverrides,
  feeCleared,
};
