"use strict";

const {
  Exams,
  ExamClasses,
  MarkSheets,
  MarkSheetRows,
  ResultVisibilityOverrides,
  Students,
  Subjects,
  Classes,
  AcademicSessions,
  TimetableSlots,
  Users,
  sequelize,
} = require("../models");
const { USER_ROLES, SHEET_STATUS, RESULT_FEE_RULES, SETTING_KEYS, STUDENT_STATUS, GRADE_BANDS } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const feeService = require("./fee.service");
const { Op, UniqueConstraintError } = require("sequelize");
const { today, monthKey } = require("../utils/dates");
const classSubjectService = require("./class_subject.service");

const EXAM_TYPES = ["Mid-Term", "Monthly Test", "Final Term", "Unit Test"];

function classLabel(klass) {
  if (!klass) return "Class";
  const section = klass.section;
  if (!section || section === "Main" || section === "General" || section === "-") {
    return klass.grade || klass.label || "Class";
  }
  return klass.label || `${klass.grade} · ${section}`;
}

function deriveExamStatus(exam, sheets, enteredCount) {
  if (exam.status === "Archived") return "Archived";
  if (!sheets.length) return exam.startDate ? "Scheduled" : "Draft";
  const statuses = sheets.map((sheet) => sheet.status);
  if (statuses.every((status) => status === SHEET_STATUS.PUBLISHED)) return "Published";
  if (statuses.every((status) => status === SHEET_STATUS.VERIFIED || status === SHEET_STATUS.PUBLISHED)) {
    return "Finalised";
  }
  if (statuses.some((status) => status !== SHEET_STATUS.DRAFT) || enteredCount > 0) {
    return "Marks Pending";
  }
  return exam.startDate ? "Scheduled" : "Draft";
}

async function syncExamStatus(examId, transaction) {
  const exam = await Exams.findByPk(examId, { transaction });
  if (!exam || exam.status === "Archived") return exam;
  const sheets = await MarkSheets.findAll({
    where: { fkExamId: examId },
    attributes: ["id", "status"],
    transaction,
  });
  const sheetIds = sheets.map((sheet) => sheet.id);
  const enteredCount = sheetIds.length
    ? await MarkSheetRows.count({
        where: {
          fkMarkSheetId: sheetIds,
          [Op.or]: [
            { obtainedMarks: { [Op.ne]: null } },
            { isAbsent: true },
            { isExempt: true },
          ],
        },
        transaction,
      })
    : 0;
  const next = deriveExamStatus(exam, sheets, enteredCount);
  if (next !== exam.status) await exam.update({ status: next }, { transaction });
  return exam;
}

function assertMarks(totalMarks, passingMarks) {
  const total = Number(totalMarks);
  const passing = Number(passingMarks);
  if (!Number.isFinite(total) || total <= 0 || total > 1000) {
    throw new ApiError(400, "Total marks must be between 1 and 1000.");
  }
  if (!Number.isFinite(passing) || passing < 0 || passing > total) {
    throw new ApiError(400, "Passing marks must be between 0 and the total marks.");
  }
  return { total, passing };
}

function assertDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(400, "The end date cannot be before the start date.");
  }
}

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

async function createSheetForClass(actor, exam, klass, subjectId, marks, transaction) {
  const subject = await Subjects.findOne({
    where: { id: subjectId, fkSchoolId: actor.schoolId },
    transaction,
  });
  if (!subject) throw new ApiError(404, `Subject ${subjectId} not found`);
  const slot = await TimetableSlots.findOne({
    where: { fkClassId: klass.id, fkSubjectId: subject.id },
    transaction,
  });
  const students = await Students.findAll({
    where: { fkClassId: klass.id, status: STUDENT_STATUS.ACTIVE },
    attributes: ["id"],
    transaction,
  });
  const sheet = await MarkSheets.create(
    {
      fkSchoolId: actor.schoolId,
      fkExamId: exam.id,
      fkClassId: klass.id,
      fkSubjectId: subject.id,
      fkTeacherId: slot ? slot.fkTeacherId : null,
      maxScore: marks.total,
      passPercent: marks.passing,
      status: SHEET_STATUS.DRAFT,
    },
    { transaction },
  );
  if (students.length) {
    await MarkSheetRows.bulkCreate(
      students.map((student) => ({ fkMarkSheetId: sheet.id, fkStudentId: student.id, score: null })),
      { transaction },
    );
  }
  return sheet;
}

async function create(actor, body) {
  if (Array.isArray(body.classIds)) return createAcrossClasses(actor, body);
  const { classId, name, feeMonth, sessionId, subjects, startDate, endDate, examType, totalMarks, passingMarks } = body;
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId } });
  if (!klass) throw new ApiError(404, "Class not found");
  assertDates(startDate, endDate);
  const marks = assertMarks(totalMarks || (subjects[0] && subjects[0].maxScore) || 100, passingMarks ?? 40);
  const examId = await sequelize.transaction(async (transaction) => {
    const exam = await Exams.create(
      {
        fkSchoolId: actor.schoolId,
        fkClassId: klass.id,
        fkSessionId: sessionId || klass.fkSessionId,
        name,
        examType: EXAM_TYPES.includes(examType) ? examType : "Mid-Term",
        totalMarks: marks.total,
        passingMarks: marks.passing,
        startDate: startDate || null,
        endDate: endDate || null,
        feeMonth: feeMonth || (endDate ? String(endDate).slice(0, 7) : null),
        status: startDate ? "Scheduled" : "Draft",
      },
      { transaction },
    );
    await ExamClasses.findOrCreate({
      where: { fkExamId: exam.id, fkClassId: klass.id },
      defaults: { fkExamId: exam.id, fkClassId: klass.id },
      transaction,
    });
    for (const item of subjects) {
      await createSheetForClass(
        actor,
        exam,
        klass,
        item.subjectId,
        { total: item.maxScore || marks.total, passing: marks.passing },
        transaction,
      );
    }
    return exam.id;
  }).catch((err) => {
    if (err instanceof UniqueConstraintError) throw new ApiError(409, "An exam with this name already exists in the session.");
    throw err;
  });
  return getExam(actor, examId);
}

async function createAcrossClasses(actor, body) {
  const classIds = [...new Set((body.classIds || []).map(Number))];
  if (!classIds.length) throw new ApiError(400, "Select at least one class.");
  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "Exam name is required.");
  if (!EXAM_TYPES.includes(body.examType)) throw new ApiError(400, "Choose an exam type.");
  assertDates(body.startDate, body.endDate);
  if (!body.startDate || !body.endDate) throw new ApiError(400, "Start and end dates are required.");
  const marks = assertMarks(body.totalMarks, body.passingMarks);
  const session = await AcademicSessions.findOne({
    where: { id: body.sessionId, fkSchoolId: actor.schoolId },
  });
  if (!session) throw new ApiError(404, "Academic session not found");
  const classes = await Classes.findAll({
    where: { id: classIds, fkSchoolId: actor.schoolId, fkSessionId: session.id },
  });
  if (classes.length !== classIds.length) {
    throw new ApiError(400, "Every class must belong to the selected session.");
  }
  const plan = [];
  for (const klass of classes) {
    const subjectIds = await classSubjectService.offeredSubjectIds(actor.schoolId, klass.id);
    if (!subjectIds.length) {
      throw new ApiError(400, `${classLabel(klass)} has no subjects assigned. Assign subjects before scheduling this exam.`);
    }
    plan.push({ klass, subjectIds });
  }
  const examId = await sequelize.transaction(async (transaction) => {
    const exam = await Exams.create(
      {
        fkSchoolId: actor.schoolId,
        fkClassId: classes[0].id,
        fkSessionId: session.id,
        name,
        examType: body.examType,
        totalMarks: marks.total,
        passingMarks: marks.passing,
        startDate: body.startDate,
        endDate: body.endDate,
        feeMonth: String(body.endDate).slice(0, 7),
        status: "Scheduled",
      },
      { transaction },
    );
    for (const item of plan) {
      await ExamClasses.create({ fkExamId: exam.id, fkClassId: item.klass.id }, { transaction });
      for (const subjectId of item.subjectIds) {
        await createSheetForClass(actor, exam, item.klass, subjectId, marks, transaction);
      }
    }
    return exam.id;
  }).catch((err) => {
    if (err instanceof UniqueConstraintError) throw new ApiError(409, "An exam with this name already exists in the session.");
    throw err;
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
    const absent = Boolean(r.absent);
    const exempt = Boolean(r.exempt) && !absent;
    if (!absent && !exempt && r.score != null && (r.score < 0 || r.score > max)) {
      throw new ApiError(400, `Scores must be between 0 and ${max}.`);
    }
  }
  await sequelize.transaction(async (transaction) => {
    for (const r of rows) {
      const absent = Boolean(r.absent);
      const exempt = Boolean(r.exempt) && !absent;
      await known.get(r.studentId).update(
        { score: absent || exempt ? null : r.score ?? null, isAbsent: absent, isExempt: exempt },
        { transaction },
      );
    }
    await syncExamStatus(sheet.fkExamId, transaction);
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
    if (action === "submit" && sheet.rows.some((r) => r.score == null && !r.isAbsent && !r.isExempt)) {
      throw new ApiError(400, "Enter a mark, or mark the student absent or exempt, before submitting.");
    }
    const extra = to === SHEET_STATUS.PUBLISHED ? { publishedAt: new Date(), fkPublishedByUserId: user.id } : {};
    await sheet.update({ status: to, ...extra });
  }
  await syncExamStatus(sheet.fkExamId);
  await auditService.record(user, `${action} mark sheet #${sheet.id} (subject #${sheet.fkSubjectId}, exam #${sheet.fkExamId})`, {
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
    include: [{
      model: MarkSheets,
      as: "sheets",
      where: { status: SHEET_STATUS.PUBLISHED },
      required: true,
      include: [
        { model: Subjects, as: "subject", attributes: ["id", "name"] },
        { model: MarkSheetRows, as: "rows", where: { fkStudentId: student.id }, required: false },
      ],
    }],
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
            subject: s.subject ? s.subject.name : null,
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

function gradeFor(percent) {
  const band = GRADE_BANDS.find((item) => percent >= item.min);
  return band ? band.grade : "F";
}

/** Published result for one student. Rank is omitted until a tie policy exists. */
async function dmc(user, examId, studentId) {
  const student = await accessService.assertStudentAccess(user, studentId);
  const exam = await Exams.findOne({
    where: { id: examId, fkSchoolId: user.schoolId },
    include: [{
      model: MarkSheets,
      as: "sheets",
      where: { status: SHEET_STATUS.PUBLISHED },
      required: false,
      include: [
        { model: Subjects, as: "subject", attributes: ["id", "name"] },
        { model: MarkSheetRows, as: "rows", where: { fkStudentId: student.id }, required: false },
      ],
    }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (user.role === USER_ROLES.PARENT) {
    const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
    const gate = await visibility(user.schoolId, exam, student.id, feeRule);
    if (!gate.visible) throw new ApiError(403, "Result withheld until fees are cleared. Please contact the school office.");
  }
  let sheets = exam.sheets || [];
  if (user.role === USER_ROLES.TEACHER) {
    const teacher = await accessService.teacherFor(user);
    const classIds = await accessService.teacherClassIds(teacher);
    if (!classIds.includes(student.fkClassId)) throw new ApiError(403, "You can only open results for your own classes.");
    sheets = sheets.filter((sheet) => sheet.fkSubjectId === teacher.fkSubjectId);
  }
  if (!sheets.length) throw new ApiError(404, "No published result for this student");
  const subjects = sheets.map((sheet) => {
    const row = sheet.rows[0];
    const score = row && row.score != null && !row.isAbsent ? Number(row.score) : null;
    const max = Number(sheet.totalMarks);
    const passing = Number(sheet.passingMarks);
    const passed = score != null && score >= passing;
    return {
      subject: sheet.subject ? sheet.subject.name : null,
      score,
      max,
      passing,
      absent: Boolean(row && row.isAbsent),
      result: row && row.isAbsent ? "Absent" : (passed ? "Pass" : "Fail"),
    };
  });
  const total = subjects.reduce((sum, item) => sum + (item.score || 0), 0);
  const max = subjects.reduce((sum, item) => sum + item.max, 0);
  const percentage = max ? Math.round((total / max) * 10000) / 100 : null;
  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo },
    exam: { id: exam.id, name: exam.name },
    subjects,
    total,
    max,
    percentage,
    grade: percentage == null ? null : gradeFor(percentage),
    passed: subjects.every((item) => item.result === "Pass"),
  };
}

function sheetProgress(sheet) {
  const rows = sheet.rows || [];
  const entered = rows.filter((row) => row.obtainedMarks != null || row.score != null || row.isAbsent || row.isExempt).length;
  return {
    id: sheet.id,
    classId: sheet.fkClassId,
    subjectId: sheet.fkSubjectId,
    subject: sheet.subject ? sheet.subject.name : "Subject",
    status: sheet.status,
    totalMarks: Number(sheet.totalMarks),
    passingMarks: Number(sheet.passingMarks),
    entered,
    students: rows.length,
  };
}

async function listSummaries(user, { sessionId } = {}) {
  const session = sessionId
    ? await AcademicSessions.findOne({ where: { id: sessionId, fkSchoolId: user.schoolId } })
    : await AcademicSessions.findOne({ where: { fkSchoolId: user.schoolId, isCurrent: true } });
  if (!session) return { session: null, exams: [] };
  const scope = await teacherScope(user);
  const exams = await Exams.findAll({
    where: { fkSchoolId: user.schoolId, fkSessionId: session.id },
    include: [
      { model: Classes, as: "classes", attributes: ["id", "grade", "section", "label"], through: { attributes: [] } },
      { model: Classes, as: "class", attributes: ["id", "grade", "section", "label"] },
      {
        model: MarkSheets,
        as: "markSheets",
        attributes: ["id", "status", "fkClassId", "fkSubjectId", "totalMarks", "passingMarks"],
        include: [
          { model: Subjects, as: "subject", attributes: ["id", "name"] },
          { model: MarkSheetRows, as: "rows", attributes: ["obtainedMarks", "isAbsent", "isExempt"] },
        ],
      },
    ],
    order: [["startDate", "ASC"], ["id", "DESC"]],
  });
  return {
    session: { id: session.id, name: session.name, isCurrent: Boolean(session.isCurrent) },
    exams: exams.map((exam) => {
      const plain = exam.get({ plain: true });
      let sheets = plain.markSheets || [];
      if (scope) {
        sheets = sheets.filter(
          (sheet) => sheet.fkSubjectId === scope.teacher.fkSubjectId && scope.classIds.includes(sheet.fkClassId),
        );
      }
      const classes = plain.classes && plain.classes.length ? plain.classes : (plain.class ? [plain.class] : []);
      return {
        id: plain.id,
        name: plain.name,
        examType: plain.examType,
        sessionId: plain.fkSessionId,
        sessionName: session.name,
        startDate: plain.startDate,
        endDate: plain.endDate,
        status: plain.status,
        totalMarks: Number(plain.totalMarks),
        passingMarks: Number(plain.passingMarks),
        feeMonth: plain.requiredFeeMonth,
        classes: classes.map((klass) => ({
          id: klass.id,
          label: classLabel(klass),
        })),
        sheets: sheets.map(sheetProgress),
      };
    }).filter((exam) => !scope || exam.sheets.length),
  };
}

async function updateExam(actor, id, body) {
  const exam = await Exams.findOne({
    where: { id, fkSchoolId: actor.schoolId },
    include: [{ model: MarkSheets, as: "markSheets", include: [{ model: MarkSheetRows, as: "rows" }] }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.status === "Published" || exam.status === "Finalised" || exam.status === "Archived") {
    throw new ApiError(400, "This exam is locked. Reopen its mark sheets before editing.");
  }
  if ((exam.markSheets || []).some((sheet) => sheet.status !== SHEET_STATUS.DRAFT)) {
    throw new ApiError(400, "Submitted mark sheets must be reopened before the exam can be edited.");
  }
  const name = body.name != null ? String(body.name).trim() : exam.name;
  if (!name) throw new ApiError(400, "Exam name is required.");
  const examType = body.examType || exam.examType;
  if (!EXAM_TYPES.includes(examType)) throw new ApiError(400, "Choose an exam type.");
  const startDate = body.startDate !== undefined ? body.startDate : exam.startDate;
  const endDate = body.endDate !== undefined ? body.endDate : exam.endDate;
  assertDates(startDate, endDate);
  const marks = assertMarks(
    body.totalMarks != null ? body.totalMarks : exam.totalMarks,
    body.passingMarks != null ? body.passingMarks : exam.passingMarks,
  );
  const nextClassIds = Array.isArray(body.classIds)
    ? [...new Set(body.classIds.map(Number))]
    : null;
  await sequelize.transaction(async (transaction) => {
    await exam.update(
      {
        name,
        examType,
        startDate: startDate || null,
        endDate: endDate || null,
        totalMarks: marks.total,
        passingMarks: marks.passing,
        feeMonth: endDate ? String(endDate).slice(0, 7) : exam.feeMonth,
      },
      { transaction },
    );
    for (const sheet of exam.markSheets) {
      await sheet.update({ maxScore: marks.total, passPercent: marks.passing }, { transaction });
    }
    if (nextClassIds) {
      if (!nextClassIds.length) throw new ApiError(400, "Select at least one class.");
      const classes = await Classes.findAll({
        where: { id: nextClassIds, fkSchoolId: actor.schoolId, fkSessionId: exam.fkSessionId },
        transaction,
      });
      if (classes.length !== nextClassIds.length) {
        throw new ApiError(400, "Every class must belong to this exam's session.");
      }
      const currentIds = new Set((exam.markSheets || []).map((sheet) => sheet.fkClassId));
      for (const klass of classes) {
        if (currentIds.has(klass.id)) continue;
        const subjectIds = await classSubjectService.offeredSubjectIds(actor.schoolId, klass.id);
        if (!subjectIds.length) {
          throw new ApiError(400, `${classLabel(klass)} has no subjects assigned.`);
        }
        await ExamClasses.findOrCreate({
          where: { fkExamId: exam.id, fkClassId: klass.id },
          defaults: { fkExamId: exam.id, fkClassId: klass.id },
          transaction,
        });
        for (const subjectId of subjectIds) {
          await createSheetForClass(actor, exam, klass, subjectId, marks, transaction);
        }
      }
      const removeIds = [...currentIds].filter((classId) => !nextClassIds.includes(classId));
      for (const classId of removeIds) {
        const sheets = exam.markSheets.filter((sheet) => sheet.fkClassId === classId);
        if (sheets.some((sheet) => (sheet.rows || []).some((row) => row.score != null || row.isAbsent || row.isExempt))) {
          throw new ApiError(400, "A class with entered marks cannot be removed.");
        }
        for (const sheet of sheets) {
          await MarkSheetRows.destroy({ where: { fkMarkSheetId: sheet.id }, transaction });
          await sheet.destroy({ transaction });
        }
        await ExamClasses.destroy({ where: { fkExamId: exam.id, fkClassId: classId }, transaction });
      }
      await exam.update({ fkClassId: nextClassIds[0] }, { transaction });
    }
    await syncExamStatus(exam.id, transaction);
  }).catch((err) => {
    if (err instanceof UniqueConstraintError) throw new ApiError(409, "An exam with this name already exists in the session.");
    throw err;
  });
  return getExam(actor, exam.id);
}

function rankValue(items, scoreOf, tie) {
  const ranked = items
    .map((item, index) => ({ index, score: scoreOf(item) }))
    .filter((item) => item.score != null)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const ranks = new Map();
  let rank = 0;
  let seen = 0;
  let last = null;
  for (const item of ranked) {
    seen += 1;
    if (last == null || item.score !== last) {
      rank = tie === "dense" ? rank + 1 : seen;
      last = item.score;
    }
    ranks.set(item.index, rank);
  }
  return ranks;
}

async function results(user, examId, { classId, subjectId } = {}) {
  const exam = await Exams.findOne({
    where: { id: examId, fkSchoolId: user.schoolId },
    include: [
      {
        model: MarkSheets,
        as: "markSheets",
        include: [
          { model: Subjects, as: "subject", attributes: ["id", "name"] },
          { model: Classes, as: "class", attributes: ["id", "grade", "section", "label"] },
          { model: MarkSheetRows, as: "rows", include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }] },
        ],
      },
    ],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  const scope = await teacherScope(user);
  let sheets = exam.markSheets || [];
  if (scope) {
    sheets = sheets.filter((sheet) => sheet.fkSubjectId === scope.teacher.fkSubjectId && scope.classIds.includes(sheet.fkClassId));
  }
  if (classId) sheets = sheets.filter((sheet) => sheet.fkClassId === Number(classId));
  if (subjectId) sheets = sheets.filter((sheet) => sheet.fkSubjectId === Number(subjectId));
  if (!sheets.length) throw new ApiError(404, "No mark sheet matches that exam, class, and subject.");
  const { feeRule, rankTie } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const byStudent = new Map();
  for (const sheet of sheets) {
    for (const row of sheet.rows || []) {
      const student = row.student;
      if (!student) continue;
      const current = byStudent.get(student.id) || {
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        obtained: 0,
        total: 0,
        absent: false,
        exempt: false,
        scored: false,
      };
      const max = Number(sheet.totalMarks);
      const passing = Number(sheet.passingMarks);
      if (row.isExempt) {
        current.exempt = true;
      } else if (row.isAbsent || row.score == null) {
        current.absent = row.isAbsent || current.absent;
        current.total += max;
        if (row.isAbsent) current.obtained += 0;
      } else {
        current.scored = true;
        current.obtained += Number(row.score);
        current.total += max;
        current.passing = (current.passing || 0) + passing;
      }
      byStudent.set(student.id, current);
    }
  }
  const rows = [...byStudent.values()].map((row) => {
    const percentage = row.total ? Math.round((row.obtained / row.total) * 10000) / 100 : null;
    const passed = row.scored && !row.absent && row.obtained >= (row.passing || 0);
    return {
      ...row,
      percentage,
      grade: percentage == null || row.absent ? null : gradeFor(percentage),
      result: row.exempt && !row.scored ? "Exempt" : row.absent && !row.scored ? "Absent" : row.scored ? (passed ? "Pass" : "Fail") : "Pending",
    };
  });
  const subjectRanks = rankValue(rows, (row) => (row.result === "Pending" || row.result === "Exempt" ? null : row.percentage), rankTie || "shared");
  const overallPool = [];
  const allSheets = (exam.markSheets || []).filter((sheet) => !scope || (sheet.fkSubjectId === scope.teacher.fkSubjectId && scope.classIds.includes(sheet.fkClassId)));
  const overallByStudent = new Map();
  for (const sheet of allSheets) {
    for (const row of sheet.rows || []) {
      if (!row.student || row.isExempt) continue;
      const current = overallByStudent.get(row.student.id) || { obtained: 0, total: 0 };
      current.total += Number(sheet.totalMarks);
      current.obtained += row.isAbsent || row.score == null ? 0 : Number(row.score);
      overallByStudent.set(row.student.id, current);
    }
  }
  for (const [studentId, totals] of overallByStudent) {
    overallPool.push({ studentId, percentage: totals.total ? totals.obtained / totals.total : null });
  }
  const overallRanks = rankValue(overallPool, (row) => row.percentage, rankTie || "shared");
  const overallIndex = new Map(overallPool.map((row, index) => [row.studentId, index]));
  const decorated = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const gate = await visibility(user.schoolId, exam, row.studentId, feeRule);
    const published = sheets.some((sheet) => sheet.status === SHEET_STATUS.PUBLISHED);
    decorated.push({
      studentId: row.studentId,
      name: row.name,
      admissionNo: row.admissionNo,
      obtained: row.scored || row.absent ? row.obtained : null,
      total: row.total,
      percentage: row.percentage,
      grade: row.grade,
      result: row.result,
      classRank: subjectRanks.get(index) ?? null,
      subjectRank: subjectRanks.get(index) ?? null,
      overallRank: overallRanks.get(overallIndex.get(row.studentId)) ?? null,
      visibility: published && gate.visible ? (gate.overridden && !gate.feeCleared ? "override" : "visible") : gate.overridden ? "override" : "hidden",
      overrideId: gate.override ? gate.override.id : null,
    });
  }
  decorated.sort((a, b) => a.name.localeCompare(b.name));
  const sheet = sheets.length === 1 ? sheets[0] : null;
  const labelSource = sheets[0];
  return {
    exam: { id: exam.id, name: exam.name, status: exam.status, examType: exam.examType },
    classLabel: labelSource && labelSource.class ? classLabel(labelSource.class) : null,
    subject: sheet && sheet.subject ? sheet.subject.name : sheets.length > 1 ? "All subjects" : null,
    totalMarks: sheet ? Number(sheet.totalMarks) : null,
    sheetStatus: sheet ? sheet.status : null,
    rankTie: rankTie || "shared",
    feeRule,
    rows: decorated,
  };
}

async function advance(actor, examId) {
  const exam = await Exams.findOne({
    where: { id: examId, fkSchoolId: actor.schoolId },
    include: [{ model: MarkSheets, as: "markSheets" }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  const sheets = exam.markSheets || [];
  if (!sheets.length) throw new ApiError(400, "This exam has no mark sheets.");
  if (sheets.every((sheet) => sheet.status === SHEET_STATUS.SUBMITTED)) {
    for (const sheet of sheets) await transition(actor, sheet.id, "verify");
    return { action: "verified" };
  }
  if (sheets.every((sheet) => sheet.status === SHEET_STATUS.VERIFIED)) {
    for (const sheet of sheets) await transition(actor, sheet.id, "publish");
    return { action: "published" };
  }
  if (sheets.every((sheet) => sheet.status === SHEET_STATUS.PUBLISHED)) {
    throw new ApiError(400, "This exam is already published.");
  }
  throw new ApiError(400, "Every subject sheet must be submitted before review, and verified before publishing.");
}

async function grantBulkOverrides(actor, examId, { classId, reason }) {
  const exam = await Exams.findOne({ where: { id: examId, fkSchoolId: actor.schoolId } });
  if (!exam) throw new ApiError(404, "Exam not found");
  const where = { fkSchoolId: actor.schoolId, fkClassId: classId || exam.fkClassId, status: STUDENT_STATUS.ACTIVE };
  const students = await Students.findAll({ where, attributes: ["id"] });
  const { feeRule } = await settingsService.get(actor.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  let granted = 0;
  for (const student of students) {
    const gate = await visibility(actor.schoolId, exam, student.id, feeRule);
    if (gate.visible || gate.overridden) continue;
    await grantOverride(actor, exam.id, { studentId: student.id, reason: reason || "Released in bulk" });
    granted += 1;
  }
  return { granted };
}

module.exports = {
  list,
  listSummaries,
  create,
  updateExam,
  getExam,
  getSheet,
  updateRows,
  transition,
  results,
  advance,
  parentResults,
  gateStatus,
  grantOverride,
  grantBulkOverrides,
  revokeOverride,
  listOverrides,
  feeCleared,
  dmc,
  EXAM_TYPES,
};
