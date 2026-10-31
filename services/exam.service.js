"use strict";

const {
  Exams,
  ExamClasses,
  ClassSubjects,
  MarkSheets,
  MarkSheetRows,
  ResultVisibilityOverrides,
  Students,
  Subjects,
  Classes,
  AcademicSessions,
  TimetableSlots,
  Users,
  Schools,
  Parents,
  sequelize,
} = require("../models");
const { USER_ROLES, SHEET_STATUS, RESULT_FEE_RULES, SETTING_KEYS, STUDENT_STATUS, GRADE_BANDS, FAIL_GRADE } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");
const settingsService = require("./settings.service");
const feeService = require("./fee.service");
const { Op, UniqueConstraintError } = require("sequelize");
const { today, monthKey } = require("../utils/dates");
const classSubjectService = require("./class_subject.service");
const { sortClasses } = require("../utils/class_order");

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

function assertDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(400, "The end date cannot be before the start date.");
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function normaliseTime(value, label) {
  if (value == null || value === "") return null;
  if (!TIME.test(String(value))) throw new ApiError(400, `${label}: use a 24-hour time like 09:00.`);
  return String(value).slice(0, 5);
}

/** Validate one paper's marks and schedule against the exam window. */
function assertPaper(paper, label, window) {
  const total = Number(paper.totalMarks);
  const passing = Number(paper.passingMarks);
  if (!Number.isFinite(total) || total <= 0 || total > 1000) {
    throw new ApiError(400, `${label}: paper marks must be between 1 and 1000.`);
  }
  if (!Number.isFinite(passing) || passing < 0 || passing > total) {
    throw new ApiError(400, `${label}: passing marks must be between 0 and that paper’s marks.`);
  }
  const paperDate = paper.paperDate || null;
  if (paperDate && window.startDate && window.endDate && (paperDate < window.startDate || paperDate > window.endDate)) {
    throw new ApiError(400, `${label}: the paper date must fall between the exam’s start and end dates.`);
  }
  const startTime = normaliseTime(paper.startTime, label);
  const endTime = normaliseTime(paper.endTime, label);
  if (startTime && endTime && endTime <= startTime) {
    throw new ApiError(400, `${label}: the paper must end after it starts.`);
  }
  return { total, passing, paperDate, startTime, endTime };
}

async function classDefaults(classId) {
  const links = await ClassSubjects.findAll({ where: { fkClassId: classId } });
  return new Map(
    links.map((link) => [
      Number(link.fkSubjectId),
      { totalMarks: Number(link.defaultTotalMarks), passingMarks: Number(link.defaultPassingMarks) },
    ]),
  );
}

/** Subjects each class sits, with the class's default paper marks. */
async function papersForClasses(actor, classIds) {
  const ids = [...new Set(classIds.map(Number))].filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) throw new ApiError(400, "Select at least one class.");
  const classes = sortClasses(await Classes.findAll({ where: { id: ids, fkSchoolId: actor.schoolId } }));
  if (classes.length !== ids.length) throw new ApiError(400, "One of those classes is not in this school.");
  const rows = [];
  for (const klass of classes) {
    const subjects = await classSubjectService.listOffered(actor.schoolId, klass.id);
    const defaults = await classDefaults(klass.id);
    rows.push({
      classId: klass.id,
      label: classLabel(klass),
      subjects: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        ...(defaults.get(subject.id) || { totalMarks: 100, passingMarks: 40 }),
      })),
    });
  }
  return rows;
}

async function planPapers(actor, sessionId, papers, window) {
  if (!Array.isArray(papers) || !papers.length) {
    throw new ApiError(400, "Enter paper marks for each subject.");
  }
  const classIds = [...new Set(papers.map((paper) => Number(paper.classId)))];
  const classes = sortClasses(await Classes.findAll({
    where: { id: classIds, fkSchoolId: actor.schoolId, fkSessionId: sessionId },
  }));
  if (classes.length !== classIds.length) {
    throw new ApiError(400, "Every class must belong to the selected session.");
  }
  const incoming = new Map();
  for (const paper of papers) {
    const key = Number(paper.classId);
    const list = incoming.get(key) || [];
    list.push(paper);
    incoming.set(key, list);
  }
  const plan = [];
  for (const klass of classes) {
    const offered = await classSubjectService.listOffered(actor.schoolId, klass.id);
    if (!offered.length) {
      throw new ApiError(400, `${classLabel(klass)} has no subjects assigned. Assign subjects before scheduling this exam.`);
    }
    const bySubject = new Map((incoming.get(klass.id) || []).map((paper) => [Number(paper.subjectId), paper]));
    const subjects = [];
    for (const subject of offered) {
      const paper = bySubject.get(subject.id);
      if (!paper) {
        throw new ApiError(400, `Enter paper marks for ${subject.name} in ${classLabel(klass)}.`);
      }
      subjects.push({ subject, marks: assertPaper(paper, `${classLabel(klass)} · ${subject.name}`, window) });
    }
    plan.push({ klass, subjects });
  }
  return plan;
}

/** Remember the marks just used as each class's defaults for the next exam. */
async function rememberDefaults(plan, transaction) {
  for (const item of plan) {
    for (const paper of item.subjects) {
      const [link] = await ClassSubjects.findOrCreate({
        where: { fkClassId: item.klass.id, fkSubjectId: paper.subject.id },
        defaults: { periodsPerWeek: 5, isElective: false },
        transaction,
      });
      await link.update(
        { defaultTotalMarks: paper.marks.total, defaultPassingMarks: paper.marks.passing },
        { transaction },
      );
    }
  }
}

function paperFields(marks) {
  return {
    totalMarks: marks.total,
    passingMarks: marks.passing,
    paperDate: marks.paperDate,
    startTime: marks.startTime,
    endTime: marks.endTime,
  };
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
  return parentVisibleExams(user, exams);
}

/**
 * BR-09/10: a parent sees only published rows of their own children, and only
 * for students whose fee rule passes or who hold an active override.
 */
async function parentVisibleExams(user, exams) {
  const studentIds = await accessService.linkedStudentIds(user);
  const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const visible = [];
  for (const exam of exams) {
    const allowed = new Set();
    for (const studentId of studentIds) {
      if ((await visibility(user.schoolId, exam, studentId, feeRule)).visible) allowed.add(studentId);
    }
    const plain = exam.get({ plain: true });
    plain.markSheets = (plain.markSheets || [])
      .filter((sheet) => sheet.status === SHEET_STATUS.PUBLISHED)
      .map((sheet) => ({ ...sheet, rows: (sheet.rows || []).filter((row) => allowed.has(row.fkStudentId)) }))
      .filter((sheet) => sheet.rows.length);
    if (plain.markSheets.length) visible.push(plain);
  }
  return visible;
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
      ...paperFields(marks),
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

function uniqueName(err) {
  if (err instanceof UniqueConstraintError) throw new ApiError(409, "An exam with this name already exists in the session.");
  throw err;
}

/** Create an exam from per-class subject papers (total, passing, date, time). */
async function create(actor, body) {
  const name = String(body.name || "").trim();
  if (!name) throw new ApiError(400, "Exam name is required.");
  if (!EXAM_TYPES.includes(body.examType)) throw new ApiError(400, "Choose an exam type.");
  if (!body.startDate || !body.endDate) throw new ApiError(400, "Start and end dates are required.");
  assertDates(body.startDate, body.endDate);
  const session = await AcademicSessions.findOne({
    where: { id: body.sessionId, fkSchoolId: actor.schoolId },
  });
  if (!session) throw new ApiError(404, "Academic session not found");
  const plan = await planPapers(actor, session.id, body.papers, body);
  const examId = await sequelize.transaction(async (transaction) => {
    const exam = await Exams.create(
      {
        fkSchoolId: actor.schoolId,
        fkClassId: plan[0].klass.id,
        fkSessionId: session.id,
        name,
        examType: body.examType,
        startDate: body.startDate,
        endDate: body.endDate,
        feeMonth: String(body.endDate).slice(0, 7),
        status: "Scheduled",
      },
      { transaction },
    );
    for (const item of plan) {
      await ExamClasses.create({ fkExamId: exam.id, fkClassId: item.klass.id }, { transaction });
      for (const paper of item.subjects) {
        await createSheetForClass(actor, exam, item.klass, paper.subject.id, paper.marks, transaction);
      }
    }
    if (body.rememberDefaults !== false) await rememberDefaults(plan, transaction);
    return exam.id;
  }).catch(uniqueName);
  return getExam(actor, examId);
}

async function getExam(user, id) {
  const [exam] = await list(user, {}).then((rows) => rows.filter((e) => e.id === Number(id)));
  if (!exam) throw new ApiError(404, "Exam not found");
  return exam;
}

/**
 * Students admitted after the exam was scheduled have no row yet. While the
 * sheet is still a draft, add a blank row for every active student missing one.
 */
async function addMissingRows(sheet) {
  if (sheet.status !== SHEET_STATUS.DRAFT) return false;
  const present = new Set(sheet.rows.map((row) => row.fkStudentId));
  const students = await Students.findAll({
    where: { fkClassId: sheet.fkClassId, status: STUDENT_STATUS.ACTIVE },
    attributes: ["id"],
  });
  const missing = students.filter((student) => !present.has(student.id));
  if (!missing.length) return false;
  await MarkSheetRows.bulkCreate(
    missing.map((student) => ({ fkMarkSheetId: sheet.id, fkStudentId: student.id, score: null })),
    { ignoreDuplicates: true },
  );
  return true;
}

async function getSheet(user, id) {
  const find = () => MarkSheets.findOne({ where: { id, fkSchoolId: user.schoolId }, include: sheetInclude });
  let sheet = await find();
  if (!sheet) throw new ApiError(404, "Mark sheet not found");
  const scope = await teacherScope(user);
  if (scope && (sheet.fkSubjectId !== scope.teacher.fkSubjectId || !scope.classIds.includes(sheet.fkClassId))) {
    throw new ApiError(403, "You can only open mark sheets for your own subject and classes.");
  }
  if (await addMissingRows(sheet)) sheet = await find();
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
    if (sheet.status === SHEET_STATUS.DRAFT) throw new ApiError(400, "This mark sheet is already open for editing.");
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
    where: { fkSchoolId: user.schoolId },
    include: [{
      model: MarkSheets,
      as: "sheets",
      where: { status: SHEET_STATUS.PUBLISHED, fkClassId: student.fkClassId },
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

/** Every class an exam covers: its papers' classes plus the exam's own class. */
async function examClassIds(exam) {
  const sheets = await MarkSheets.findAll({ where: { fkExamId: exam.id }, attributes: ["fkClassId"] });
  return [...new Set([exam.fkClassId, ...sheets.map((sheet) => sheet.fkClassId)].filter(Boolean))];
}

/** Staff view of who can / cannot see an exam's results and why. */
async function gateStatus(user, examId) {
  const exam = await Exams.findOne({ where: { id: examId, fkSchoolId: user.schoolId }, include: [{ model: MarkSheets, as: "sheets", attributes: ["id", "status"] }] });
  if (!exam) throw new ApiError(404, "Exam not found");
  const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const students = await Students.findAll({ where: { fkClassId: await examClassIds(exam), fkSchoolId: user.schoolId }, attributes: ["id", "firstName", "lastName", "admissionNo"], order: [["firstName", "ASC"]] });
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
  const student = await Students.findOne({ where: { id: studentId, fkClassId: await examClassIds(exam), fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student is not in this exam's class");
  // D9: a reason is always required (SRS addendum §8 leaves it to the school; the school requires it).
  if (String(reason || "").trim().length < 3) throw new ApiError(400, "A reason is required for an override.");
  if (await activeOverride(exam.id, student.id)) throw new ApiError(409, "An override is already active for this student.");
  return sequelize.transaction(async (transaction) => {
    const override = await ResultVisibilityOverrides.create(
      {
        fkSchoolId: actor.schoolId,
        fkExamId: exam.id,
        fkStudentId: student.id,
        reason: String(reason).trim(),
        fkGrantedByUserId: actor.id,
        grantedAt: new Date(),
      },
      { transaction },
    );
    await auditService.record(
      actor,
      `released ${exam.name} result for ${student.firstName} ${student.lastName} despite fees`,
      {
        entityType: "result_visibility_override",
        entityId: override.id,
        metadata: { examId: exam.id, studentId: student.id, reason: override.reason, grantedAt: override.grantedAt },
      },
      { transaction },
    );
    return override;
  });
}

async function revokeOverride(actor, overrideId) {
  const override = await ResultVisibilityOverrides.findOne({ where: { id: overrideId, fkSchoolId: actor.schoolId, revokedAt: null } });
  if (!override) throw new ApiError(404, "Active override not found");
  return sequelize.transaction(async (transaction) => {
    await override.update({ revokedAt: new Date(), fkRevokedByUserId: actor.id }, { transaction });
    await auditService.record(
      actor,
      `revoked result override #${override.id}`,
      {
        entityType: "result_visibility_override",
        entityId: override.id,
        metadata: { examId: override.fkExamId, studentId: override.fkStudentId },
      },
      { transaction },
    );
    return override;
  });
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

/** Letter grade from the percentage; a failed result is always F, a pass never is. */
function gradeFor(percent, passed, bands = GRADE_BANDS) {
  if (percent == null) return null;
  if (!passed) return FAIL_GRADE;
  const band = bands.find((item) => percent >= item.min);
  return band ? band.grade : bands[bands.length - 1].grade;
}

/** The school's grade bands (Settings → Grading scale), highest first. */
async function gradeBands(schoolId) {
  const { bands } = await settingsService.get(schoolId, SETTING_KEYS.GRADING);
  return [...bands].sort((a, b) => b.min - a.min);
}

function percentOf(obtained, total) {
  return total ? Math.round((obtained / total) * 10000) / 100 : null;
}

/**
 * One student's outcome on one paper. Absent counts as a fail; Exempt is
 * left out of totals and the overall result.
 */
function paperOutcome(sheet, row) {
  const total = Number(sheet.totalMarks);
  const passing = Number(sheet.passingMarks);
  const base = { subjectId: sheet.fkSubjectId, subject: sheet.subject ? sheet.subject.name : null, total, passing };
  if (!row) return { ...base, obtained: null, status: "Pending" };
  if (row.isExempt) return { ...base, obtained: null, status: "Exempt" };
  if (row.isAbsent) return { ...base, obtained: 0, status: "Absent" };
  if (row.score == null) return { ...base, obtained: null, status: "Pending" };
  const obtained = Number(row.score);
  return { ...base, obtained, status: obtained >= passing ? "Pass" : "Fail" };
}

/** Combine paper outcomes: pass only if every counted paper is passed. */
function overallOutcome(papers, bands = GRADE_BANDS) {
  const counted = papers.filter((paper) => paper.status !== "Exempt");
  const obtained = counted.reduce((sum, paper) => sum + (paper.obtained || 0), 0);
  const total = counted.reduce((sum, paper) => sum + paper.total, 0);
  const failedPapers = counted.filter((paper) => paper.status === "Fail" || paper.status === "Absent").length;
  let result;
  if (!counted.length) result = "Exempt";
  else if (counted.some((paper) => paper.status === "Pending")) result = "Pending";
  else if (counted.every((paper) => paper.status === "Absent")) result = "Absent";
  else result = failedPapers ? "Fail" : "Pass";
  const percentage = result === "Pending" || result === "Exempt" ? null : percentOf(obtained, total);
  return {
    obtained,
    total,
    percentage,
    failedPapers,
    result,
    passed: result === "Pass",
    grade: percentage == null ? null : gradeFor(percentage, result === "Pass", bands),
  };
}

/**
 * Detailed marks certificate. Parents see published sheets only, and only
 * when the fee visibility rule (or an override) lets them. Staff can preview
 * in-progress marks; the result is then flagged as provisional.
 */
async function dmc(user, examId, studentId) {
  const student = await accessService.assertStudentAccess(user, studentId);
  const isParent = user.role === USER_ROLES.PARENT;
  const exam = await Exams.findOne({
    where: { id: examId, fkSchoolId: user.schoolId },
    include: [{
      model: MarkSheets,
      as: "sheets",
      where: isParent ? { status: SHEET_STATUS.PUBLISHED } : { fkClassId: student.fkClassId },
      required: false,
      include: [
        { model: Subjects, as: "subject", attributes: ["id", "name"] },
        { model: MarkSheetRows, as: "rows", where: { fkStudentId: student.id }, required: false },
      ],
    }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (isParent) {
    const { feeRule } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
    const gate = await visibility(user.schoolId, exam, student.id, feeRule);
    if (!gate.visible) throw new ApiError(403, "Result withheld until fees are cleared. Please contact the school office.");
  }
  let sheets = (exam.sheets || []).filter((sheet) => sheet.fkClassId === student.fkClassId);
  if (user.role === USER_ROLES.TEACHER) {
    const teacher = await accessService.teacherFor(user);
    const classIds = await accessService.teacherClassIds(teacher);
    if (!classIds.includes(student.fkClassId)) throw new ApiError(403, "You can only open results for your own classes.");
    sheets = sheets.filter((sheet) => sheet.fkSubjectId === teacher.fkSubjectId);
  }
  if (!sheets.length) throw new ApiError(404, isParent ? "No published result for this student" : "This student has no papers in this exam.");
  sheets.sort((a, b) => String(a.subject ? a.subject.name : "").localeCompare(String(b.subject ? b.subject.name : "")));
  const papers = sheets.map((sheet) => paperOutcome(sheet, sheet.rows[0]));
  const bands = await gradeBands(user.schoolId);
  const overall = overallOutcome(papers, bands);
  const standing = await buildResults(user, examId, { classId: student.fkClassId, publishedOnly: isParent });
  const own = standing.rows.find((row) => row.studentId === student.id);
  const profile = await Students.findOne({
    where: { id: student.id },
    include: [
      { model: Classes, as: "class", attributes: ["id", "grade", "section", "label"] },
      { model: Parents, as: "parents", attributes: ["guardianName", "fatherName", "primaryContactNumber"], through: { attributes: ["isPrimary"] } },
    ],
  });
  const guardian = (profile.parents || []).find((parent) => parent.StudentParents && parent.StudentParents.isPrimary) || (profile.parents || [])[0];
  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      className: profile.class ? classLabel(profile.class) : null,
      guardian: guardian ? guardian.guardianName || guardian.fatherName : null,
      dateOfBirth: profile.dateOfBirth || null,
      gender: profile.gender || null,
    },
    exam: { id: exam.id, name: exam.name },
    subjects: papers.map((paper) => ({
      subject: paper.subject,
      score: paper.status === "Absent" ? null : paper.obtained,
      max: paper.total,
      passing: paper.passing,
      absent: paper.status === "Absent",
      exempt: paper.status === "Exempt",
      result: paper.status,
      grade: paper.obtained == null || paper.status === "Absent" ? null : gradeFor(percentOf(paper.obtained, paper.total), paper.status === "Pass", bands),
    })),
    total: overall.obtained,
    max: overall.total,
    percentage: overall.percentage,
    grade: overall.grade,
    result: overall.result,
    passed: overall.passed,
    classRank: own ? own.classRank : null,
    classSize: standing.rows.length,
    provisional: sheets.some((sheet) => sheet.status !== SHEET_STATUS.PUBLISHED),
  };
}

function sheetProgress(sheet) {
  const rows = sheet.rows || [];
  const entered = rows.filter((row) => row.obtainedMarks != null || row.isAbsent || row.isExempt).length;
  return {
    id: sheet.id,
    classId: sheet.fkClassId,
    subjectId: sheet.fkSubjectId,
    subject: sheet.subject ? sheet.subject.name : "Subject",
    status: sheet.status,
    totalMarks: Number(sheet.totalMarks),
    passingMarks: Number(sheet.passingMarks),
    paperDate: sheet.paperDate || null,
    startTime: sheet.startTime ? String(sheet.startTime).slice(0, 5) : null,
    endTime: sheet.endTime ? String(sheet.endTime).slice(0, 5) : null,
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
        attributes: ["id", "status", "fkClassId", "fkSubjectId", "totalMarks", "passingMarks", "paperDate", "startTime", "endTime"],
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
      const classes = sortClasses(plain.classes && plain.classes.length ? plain.classes : (plain.class ? [plain.class] : []));
      const order = new Map(classes.map((klass, index) => [klass.id, index]));
      sheets = [...sheets].sort(
        (a, b) =>
          (order.get(a.fkClassId) ?? 99) - (order.get(b.fkClassId) ?? 99) ||
          String(a.subject ? a.subject.name : "").localeCompare(String(b.subject ? b.subject.name : "")),
      );
      return {
        id: plain.id,
        name: plain.name,
        examType: plain.examType,
        sessionId: plain.fkSessionId,
        sessionName: session.name,
        startDate: plain.startDate,
        endDate: plain.endDate,
        status: plain.status,
        phase: examPhase(plain),
        feeMonth: plain.requiredFeeMonth,
        classes: classes.map((klass) => ({ id: klass.id, label: classLabel(klass) })),
        sheets: sheets.map(sheetProgress),
      };
    }).filter((exam) => !scope || exam.sheets.length),
  };
}

const LOCKED_EXAM = ["Published", "Finalised", "Archived"];

/**
 * Where an exam sits in its lifecycle, from its dates and status:
 * - upcoming: not started yet; fully editable and deletable.
 * - ongoing:  between start and end date; limited edits, no delete.
 * - past:     ended, or results finalised/published; archive only.
 */
function examPhase(exam, on = today()) {
  if (LOCKED_EXAM.includes(exam.status)) return "past";
  if (exam.endDate && exam.endDate < on) return "past";
  if (exam.startDate && exam.startDate <= on) return "ongoing";
  return "upcoming";
}

const PHASE_MESSAGES = {
  pastEdit: "This exam has ended, so it can no longer be edited. Archive it instead.",
  pastDelete: "This exam has ended, so it cannot be deleted. Archive it instead.",
  ongoingDelete: "This exam is in progress, so it cannot be deleted.",
  ongoingType: "The exam type cannot change while the exam is in progress.",
  ongoingStart: "The start date cannot change while the exam is in progress.",
  ongoingEnd: "While the exam is in progress the end date can only be extended.",
  ongoingRemove: "Papers cannot be removed while the exam is in progress.",
  ongoingChange: "Existing papers cannot be changed while the exam is in progress. Only new papers can be added.",
  ongoingPastPaper: "A new paper must be dated today or later.",
};

function samePaper(sheet, marks) {
  const time = (value) => (value ? String(value).slice(0, 5) : null);
  return Number(sheet.totalMarks) === marks.total
    && Number(sheet.passingMarks) === marks.passing
    && (sheet.paperDate || null) === marks.paperDate
    && time(sheet.startTime) === marks.startTime
    && time(sheet.endTime) === marks.endTime;
}

/** Ongoing exams: rename, extend the end date, or add papers dated today or later. */
function assertOngoingEdit(exam, body, plan) {
  if (body.examType && body.examType !== exam.examType) throw new ApiError(409, PHASE_MESSAGES.ongoingType);
  if (body.startDate !== undefined && body.startDate !== exam.startDate) throw new ApiError(409, PHASE_MESSAGES.ongoingStart);
  if (body.endDate !== undefined && (!body.endDate || (exam.endDate && body.endDate < exam.endDate))) {
    throw new ApiError(409, PHASE_MESSAGES.ongoingEnd);
  }
  if (!plan) return;
  const planned = new Map();
  for (const item of plan) {
    for (const paper of item.subjects) planned.set(`${item.klass.id}:${paper.subject.id}`, paper.marks);
  }
  for (const sheet of exam.markSheets || []) {
    const marks = planned.get(`${sheet.fkClassId}:${sheet.fkSubjectId}`);
    if (!marks) throw new ApiError(409, PHASE_MESSAGES.ongoingRemove);
    if (!samePaper(sheet, marks)) throw new ApiError(409, PHASE_MESSAGES.ongoingChange);
    planned.delete(`${sheet.fkClassId}:${sheet.fkSubjectId}`);
  }
  const on = today();
  for (const marks of planned.values()) {
    if (!marks.paperDate || marks.paperDate < on) throw new ApiError(409, PHASE_MESSAGES.ongoingPastPaper);
  }
}

function hasMarks(sheet) {
  return (sheet.rows || []).some((row) => row.score != null || row.isAbsent || row.isExempt);
}

async function removeSheets(sheets, transaction) {
  for (const sheet of sheets) {
    await MarkSheetRows.destroy({ where: { fkMarkSheetId: sheet.id }, transaction });
    await sheet.destroy({ force: true, transaction });
  }
}

async function updateExam(actor, id, body) {
  const exam = await Exams.findOne({
    where: { id, fkSchoolId: actor.schoolId },
    include: [{ model: MarkSheets, as: "markSheets", include: [{ model: MarkSheetRows, as: "rows" }] }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  const phase = examPhase(exam);
  if (phase === "past") throw new ApiError(409, PHASE_MESSAGES.pastEdit);
  if (phase === "upcoming" && (exam.markSheets || []).some((sheet) => sheet.status !== SHEET_STATUS.DRAFT)) {
    throw new ApiError(400, "Submitted mark sheets must be reopened before the exam can be edited.");
  }
  if (body.sessionId != null && Number(body.sessionId) !== Number(exam.fkSessionId)) {
    throw new ApiError(400, "The session at the top of the portal is not the session this exam was scheduled in.");
  }
  const name = body.name != null ? String(body.name).trim() : exam.name;
  if (!name) throw new ApiError(400, "Exam name is required.");
  const examType = body.examType || exam.examType;
  if (!EXAM_TYPES.includes(examType)) throw new ApiError(400, "Choose an exam type.");
  const startDate = body.startDate !== undefined ? body.startDate : exam.startDate;
  const endDate = body.endDate !== undefined ? body.endDate : exam.endDate;
  assertDates(startDate, endDate);
  const plan = Array.isArray(body.papers)
    ? await planPapers(actor, exam.fkSessionId, body.papers, { startDate, endDate })
    : null;
  if (phase === "ongoing") assertOngoingEdit(exam, body, plan);
  await sequelize.transaction(async (transaction) => {
    await exam.update(
      {
        name,
        examType,
        startDate: startDate || null,
        endDate: endDate || null,
        feeMonth: endDate ? String(endDate).slice(0, 7) : exam.feeMonth,
      },
      { transaction },
    );
    if (!plan) return;
    const wanted = new Map();
    for (const item of plan) {
      for (const paper of item.subjects) wanted.set(`${item.klass.id}:${paper.subject.id}`, { item, paper });
    }
    for (const sheet of exam.markSheets) {
      const match = wanted.get(`${sheet.fkClassId}:${sheet.fkSubjectId}`);
      if (!match) {
        if (hasMarks(sheet)) throw new ApiError(400, "A paper with entered marks cannot be removed.");
        await removeSheets([sheet], transaction);
        continue;
      }
      const tooHigh = (sheet.rows || []).some((row) => row.score != null && Number(row.score) > match.paper.marks.total);
      if (tooHigh) throw new ApiError(400, "A saved mark is higher than the new paper total. Lower that mark first.");
      await sheet.update(paperFields(match.paper.marks), { transaction });
      wanted.delete(`${sheet.fkClassId}:${sheet.fkSubjectId}`);
    }
    for (const { item, paper } of wanted.values()) {
      await createSheetForClass(actor, exam, item.klass, paper.subject.id, paper.marks, transaction);
    }
    const classIds = plan.map((item) => item.klass.id);
    for (const classId of classIds) {
      await ExamClasses.findOrCreate({
        where: { fkExamId: exam.id, fkClassId: classId },
        defaults: { fkExamId: exam.id, fkClassId: classId },
        transaction,
      });
    }
    await ExamClasses.destroy({ where: { fkExamId: exam.id, fkClassId: { [Op.notIn]: classIds } }, transaction });
    await exam.update({ fkClassId: classIds[0] }, { transaction });
    if (body.rememberDefaults !== false) await rememberDefaults(plan, transaction);
    await syncExamStatus(exam.id, transaction);
  }).catch(uniqueName);
  return getExam(actor, exam.id);
}

/** Only exams with no submitted work can be deleted; published ones are archived. */
async function removeExam(actor, id) {
  const exam = await Exams.findOne({
    where: { id, fkSchoolId: actor.schoolId },
    include: [{ model: MarkSheets, as: "markSheets" }],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  const phase = examPhase(exam);
  if (phase === "past") throw new ApiError(409, PHASE_MESSAGES.pastDelete);
  if (phase === "ongoing") throw new ApiError(409, PHASE_MESSAGES.ongoingDelete);
  if ((exam.markSheets || []).some((sheet) => sheet.status !== SHEET_STATUS.DRAFT)) {
    throw new ApiError(400, "Reopen submitted mark sheets before deleting this exam.");
  }
  // Drafts are removed outright so the exam name can be reused.
  await sequelize.transaction(async (transaction) => {
    await removeSheets(exam.markSheets || [], transaction);
    await ExamClasses.destroy({ where: { fkExamId: exam.id }, transaction });
    await exam.destroy({ force: true, transaction });
  });
  await auditService.record(actor, `deleted exam ${exam.name}`, { entityType: "exam", entityId: exam.id });
  return { id: Number(id) };
}

async function archiveExam(actor, id) {
  const exam = await Exams.findOne({ where: { id, fkSchoolId: actor.schoolId } });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.status === "Archived") return getExam(actor, exam.id);
  if (examPhase(exam) !== "past") {
    throw new ApiError(409, "Only an exam that has ended can be archived. Delete or edit an upcoming exam instead.");
  }
  await exam.update({ status: "Archived" });
  await auditService.record(actor, `archived exam ${exam.name}`, { entityType: "exam", entityId: exam.id });
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

/**
 * Results for one class: either one paper (subjectId) or every paper with an
 * overall Pass/Fail per student. Ranks are within the class only.
 */
/** Class-wide results are staff documents; parents only ever get their own child's DMC. */
async function results(user, examId, query = {}) {
  if (user.role === USER_ROLES.PARENT) throw new ApiError(403, "Class results are available to school staff only.");
  return buildResults(user, examId, query);
}

/** Per-paper summary used by the class and overall reports. */
function paperStats(sheet, papers) {
  const scored = papers.filter((paper) => paper.status === "Pass" || paper.status === "Fail");
  const marks = scored.map((paper) => paper.obtained);
  return {
    subjectId: sheet.fkSubjectId,
    subject: sheet.subject ? sheet.subject.name : "Subject",
    sat: scored.length,
    passed: papers.filter((paper) => paper.status === "Pass").length,
    failed: papers.filter((paper) => paper.status === "Fail" || paper.status === "Absent").length,
    absent: papers.filter((paper) => paper.status === "Absent").length,
    exempt: papers.filter((paper) => paper.status === "Exempt").length,
    highest: marks.length ? Math.max(...marks) : null,
    lowest: marks.length ? Math.min(...marks) : null,
    average: marks.length ? Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 100) / 100 : null,
  };
}

async function buildResults(user, examId, { classId, subjectId, publishedOnly = false } = {}) {
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
  const targetClassId = classId
    ? Number(classId)
    : (sortClasses(sheets.map((sheet) => sheet.class).filter(Boolean))[0] || {}).id;
  sheets = sheets.filter((sheet) => sheet.fkClassId === targetClassId);
  if (subjectId) sheets = sheets.filter((sheet) => sheet.fkSubjectId === Number(subjectId));
  if (publishedOnly) sheets = sheets.filter((sheet) => sheet.status === SHEET_STATUS.PUBLISHED);
  if (!sheets.length) throw new ApiError(404, "No mark sheet matches that exam, class, and subject.");
  sheets.sort((a, b) => String(a.subject ? a.subject.name : "").localeCompare(String(b.subject ? b.subject.name : "")));
  const { feeRule, rankTie } = await settingsService.get(user.schoolId, SETTING_KEYS.RESULT_VISIBILITY);
  const bands = await gradeBands(user.schoolId);

  const students = new Map();
  for (const sheet of sheets) {
    for (const row of sheet.rows || []) {
      if (row.student && !students.has(row.student.id)) students.set(row.student.id, row.student);
    }
  }
  const rows = [...students.values()].map((student) => {
    const papers = sheets.map((sheet) => paperOutcome(sheet, (sheet.rows || []).find((row) => row.fkStudentId === student.id)));
    return {
      studentId: student.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      papers,
      ...overallOutcome(papers, bands),
    };
  });
  const ranks = rankValue(rows, (row) => (row.result === "Pending" || row.result === "Exempt" ? null : row.percentage), rankTie || "shared");
  const published = sheets.some((sheet) => sheet.status === SHEET_STATUS.PUBLISHED);
  const decorated = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const gate = await visibility(user.schoolId, exam, row.studentId, feeRule);
    decorated.push({
      studentId: row.studentId,
      name: row.name,
      admissionNo: row.admissionNo,
      obtained: row.result === "Pending" || row.result === "Exempt" ? null : row.obtained,
      total: row.total,
      percentage: row.percentage,
      grade: row.grade,
      result: row.result,
      failedPapers: row.failedPapers,
      papers: row.papers.map((paper) => ({
        subjectId: paper.subjectId,
        obtained: paper.obtained,
        status: paper.status,
        grade: paper.obtained == null || paper.status === "Absent" ? null : gradeFor(percentOf(paper.obtained, paper.total), paper.status === "Pass", bands),
      })),
      classRank: ranks.get(index) ?? null,
      visibility: published && gate.visible ? (gate.overridden && !gate.feeCleared ? "override" : "visible") : gate.overridden ? "override" : "hidden",
      overrideId: gate.override ? gate.override.id : null,
    });
  }
  decorated.sort((a, b) => a.name.localeCompare(b.name));
  const single = sheets.length === 1 ? sheets[0] : null;
  return {
    exam: { id: exam.id, name: exam.name, status: exam.status, examType: exam.examType },
    classId: targetClassId,
    classLabel: sheets[0].class ? classLabel(sheets[0].class) : null,
    subject: single && single.subject ? single.subject.name : "All subjects",
    papers: sheets.map((sheet) => ({
      sheetId: sheet.id,
      subjectId: sheet.fkSubjectId,
      subject: sheet.subject ? sheet.subject.name : "Subject",
      totalMarks: Number(sheet.totalMarks),
      passingMarks: Number(sheet.passingMarks),
      status: sheet.status,
    })),
    totalMarks: sheets.reduce((sum, sheet) => sum + Number(sheet.totalMarks), 0),
    sheetStatus: single ? single.status : null,
    rankTie: rankTie || "shared",
    feeRule,
    provisional: sheets.some((sheet) => sheet.status !== SHEET_STATUS.PUBLISHED),
    paperStats: sheets.map((sheet, index) => paperStats(sheet, rows.map((row) => row.papers[index]))),
    rows: decorated,
  };
}

/** Header details every printed exam document carries. */
async function documentMeta(user, examId) {
  const exam = await Exams.findOne({
    where: { id: examId, fkSchoolId: user.schoolId },
    include: [
      { model: Schools, as: "school", attributes: ["id", "name"] },
      { model: AcademicSessions, as: "session", attributes: ["id", "name"] },
    ],
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  return {
    school: { name: exam.school ? exam.school.name : "School" },
    session: exam.session ? exam.session.name : null,
    exam: {
      id: exam.id,
      name: exam.name,
      examType: exam.examType,
      status: exam.status,
      startDate: exam.startDate || null,
      endDate: exam.endDate || null,
    },
    generatedAt: new Date().toISOString(),
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
  const submitted = sheets.filter((sheet) => sheet.status !== SHEET_STATUS.DRAFT).length;
  throw new ApiError(400, `${submitted} of ${sheets.length} mark sheets are submitted. Submit every sheet before review.`);
}

async function grantBulkOverrides(actor, examId, { classId, reason }) {
  const exam = await Exams.findOne({ where: { id: examId, fkSchoolId: actor.schoolId } });
  if (!exam) throw new ApiError(404, "Exam not found");
  const covered = await examClassIds(exam);
  const targetClassId = Number(classId || exam.fkClassId);
  if (!covered.includes(targetClassId)) throw new ApiError(400, "That class does not sit this exam.");
  const where = { fkSchoolId: actor.schoolId, fkClassId: targetClassId, status: STUDENT_STATUS.ACTIVE };
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
  papersForClasses,
  create,
  updateExam,
  removeExam,
  archiveExam,
  getExam,
  getSheet,
  updateRows,
  transition,
  results,
  documentMeta,
  examPhase,
  advance,
  parentResults,
  gateStatus,
  grantOverride,
  grantBulkOverrides,
  revokeOverride,
  listOverrides,
  feeCleared,
  dmc,
  gradeFor,
  paperOutcome,
  overallOutcome,
  EXAM_TYPES,
};
