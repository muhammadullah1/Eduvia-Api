"use strict";

const { AuditLogs, ClassSubjects, MarkSheets, Subjects } = require("../../models");
const examService = require("../../services/exam.service");
const feeService = require("../../services/fee.service");
const { USER_ROLES } = require("../../constants");
const { monthKey, today } = require("../../utils/dates");
const { actorFor, makeClass, makeParent, makeSchool, makeStudent, makeUser, uid } = require("../helpers/school");

const PAPER = { totalMarks: 100, passingMarks: 40, startTime: "09:00", endTime: "11:00" };

async function fixture() {
  const { school, session } = await makeSchool();
  const admin = await actorFor(await makeUser(school.id, USER_ROLES.SUPER_ADMIN));
  const english = await Subjects.create({ fkSchoolId: school.id, name: "English", code: `GE${uid()}`.slice(0, 20) });
  const first = await makeClass(school.id, session.id, `Gate A ${uid()}`);
  const second = await makeClass(school.id, session.id, `Gate B ${uid()}`);
  for (const klass of [first, second]) {
    await ClassSubjects.create({ fkClassId: klass.id, fkSubjectId: english.id, defaultTotalMarks: 100, defaultPassingMarks: 40 });
  }
  const kid = await makeStudent(school.id, second.id);
  const parent = await actorFor(await makeParent(school.id, kid.id));
  const exam = await examService.create(admin, {
    name: "Gate Term",
    examType: "Mid-Term",
    sessionId: session.id,
    startDate: "2026-11-01",
    endDate: "2026-11-15",
    papers: [first, second].map((klass) => ({ ...PAPER, classId: klass.id, subjectId: english.id, paperDate: "2026-11-02" })),
  });
  const sheet = await MarkSheets.findOne({ where: { fkExamId: exam.id, fkClassId: second.id } });
  await examService.updateRows(admin, sheet.id, [{ studentId: kid.id, score: 77 }]);
  for (const action of ["submit", "verify", "publish"]) await examService.transition(admin, sheet.id, action);
  await feeService.generateMonths(admin, { month: monthKey(today()), classId: second.id });
  return { admin, parent, exam, kid, first, second };
}

const visibleScores = (exams, examId) =>
  exams.filter((row) => row.id === examId).flatMap((row) => row.markSheets.flatMap((sheet) => sheet.rows.map((r) => Number(r.score))));

describe("result fee gate (BR-09 / BR-10)", () => {
  test("unpaid fees hide marks from every parent read path until an audited override", async () => {
    const fx = await fixture();

    expect(visibleScores(await examService.list(fx.parent), fx.exam.id)).toEqual([]);
    await expect(examService.getExam(fx.parent, fx.exam.id)).rejects.toThrow(/not found/i);
    await expect(examService.dmc(fx.parent, fx.exam.id, fx.kid.id)).rejects.toThrow(/withheld/);
    const gated = (await examService.parentResults(fx.parent, fx.kid.id)).exams.find((row) => row.examId === fx.exam.id);
    expect(gated).toMatchObject({ visible: false, subjects: [] });

    const override = await examService.grantOverride(fx.admin, fx.exam.id, { studentId: fx.kid.id, reason: "Principal approved" });
    const granted = await AuditLogs.findOne({ where: { entityType: "result_visibility_override", entityId: override.id } });
    expect(granted.metadata).toMatchObject({ studentId: fx.kid.id, reason: "Principal approved" });
    expect(granted.actorUserId).toBe(fx.admin.id);

    expect(visibleScores(await examService.list(fx.parent), fx.exam.id)).toEqual([77]);
    expect((await examService.dmc(fx.parent, fx.exam.id, fx.kid.id)).student.id).toBe(fx.kid.id);

    await examService.revokeOverride(fx.admin, override.id);
    expect(await AuditLogs.count({ where: { entityType: "result_visibility_override", entityId: override.id } })).toBe(2);
    expect(visibleScores(await examService.list(fx.parent), fx.exam.id)).toEqual([]);
  });

  test("overrides need a reason and a class that sits the exam", async () => {
    const fx = await fixture();
    await expect(examService.grantOverride(fx.admin, fx.exam.id, { studentId: fx.kid.id, reason: " " })).rejects.toThrow(/reason/);
    const outsider = await makeClass(fx.admin.schoolId, fx.exam.fkSessionId, `Gate C ${uid()}`);
    await expect(examService.grantBulkOverrides(fx.admin, fx.exam.id, { classId: outsider.id, reason: "Bulk" })).rejects.toThrow(/does not sit/);
    const status = await examService.gateStatus(fx.admin, fx.exam.id);
    expect(status.rows.map((row) => row.student.id)).toContain(fx.kid.id);
  });
});
