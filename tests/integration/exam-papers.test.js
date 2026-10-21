"use strict";

const { Schools, AcademicSessions, Users, Subjects, Classes, Students, ClassSubjects, MarkSheets } = require("../../models");
const examService = require("../../services/exam.service");
const { USER_ROLES } = require("../../constants");

async function buildSchool() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const school = await Schools.create({ name: `Paper School ${stamp}`, email: `paper-${stamp}@example.com`, code: `PS${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true,
  });
  const admin = await Users.create({
    fkSchoolId: school.id, firstName: "Ada", lastName: "Admin", email: `paper-admin-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.SUPER_ADMIN, status: "active",
  });
  const english = await Subjects.create({ fkSchoolId: school.id, name: "English", code: `PE${stamp}`.slice(0, 20) });
  const islamiyat = await Subjects.create({ fkSchoolId: school.id, name: "Islamiyat", code: `PI${stamp}`.slice(0, 20) });
  const klass = await Classes.create({
    fkSchoolId: school.id, fkSessionId: session.id, grade: "KG", section: "Main", label: "KG", monthlyTuitionFee: 1000, capacity: 30,
  });
  await ClassSubjects.create({ fkClassId: klass.id, fkSubjectId: english.id, defaultTotalMarks: 100, defaultPassingMarks: 40 });
  await ClassSubjects.create({ fkClassId: klass.id, fkSubjectId: islamiyat.id, defaultTotalMarks: 50, defaultPassingMarks: 25 });
  const students = [];
  for (const [index, firstName] of ["Ali", "Hira", "Saad"].entries()) {
    students.push(await Students.create({
      fkSchoolId: school.id, fkClassId: klass.id, admissionNo: `P${index}-${stamp}`.slice(0, 20),
      firstName, lastName: "Khan", gender: "Male", dateOfBirth: "2021-01-01", admissionDate: "2026-04-01", status: "Active",
    }));
  }
  const actor = { id: admin.id, schoolId: school.id, role: admin.role, email: admin.email };
  return { school, session, actor, english, islamiyat, klass, students };
}

function papers(fx, overrides = {}) {
  return [
    { classId: fx.klass.id, subjectId: fx.english.id, totalMarks: 100, passingMarks: 40, paperDate: "2026-11-02", startTime: "09:00", endTime: "11:00", ...overrides },
    { classId: fx.klass.id, subjectId: fx.islamiyat.id, totalMarks: 50, passingMarks: 25, paperDate: "2026-11-03", startTime: "09:00", endTime: "10:00" },
  ];
}

describe("exam papers", () => {
  test("class defaults, per-paper schedule, class-only ranks and overall pass/fail", async () => {
    const fx = await buildSchool();
    const [defaults] = await examService.papersForClasses(fx.actor, [fx.klass.id]);
    expect(defaults.subjects.map((s) => [s.name, s.totalMarks, s.passingMarks])).toEqual([["English", 100, 40], ["Islamiyat", 50, 25]]);

    const base = { name: "Mid Term", examType: "Mid-Term", sessionId: fx.session.id, startDate: "2026-11-01", endDate: "2026-11-15" };
    await expect(examService.create(fx.actor, { ...base, papers: papers(fx, { paperDate: "2026-12-01" }) })).rejects.toThrow(/paper date/);
    await expect(examService.create(fx.actor, { ...base, papers: papers(fx, { endTime: "08:00" }) })).rejects.toThrow(/end after/);

    const exam = await examService.create(fx.actor, { ...base, papers: papers(fx) });
    const [summary] = (await examService.listSummaries(fx.actor, { sessionId: fx.session.id })).exams;
    expect(summary.totalMarks).toBeUndefined();
    expect(summary.sheets.map((s) => [s.subject, s.totalMarks, s.passingMarks, s.paperDate, s.startTime])).toEqual([
      ["English", 100, 40, "2026-11-02", "09:00"],
      ["Islamiyat", 50, 25, "2026-11-03", "09:00"],
    ]);

    const sheets = await MarkSheets.findAll({ where: { fkExamId: exam.id } });
    const eng = sheets.find((s) => s.fkSubjectId === fx.english.id);
    const isl = sheets.find((s) => s.fkSubjectId === fx.islamiyat.id);
    const [ali, hira, saad] = fx.students;
    await expect(examService.updateRows(fx.actor, isl.id, [{ studentId: ali.id, score: 60 }])).rejects.toThrow(/between 0 and 50/);
    await examService.updateRows(fx.actor, eng.id, [
      { studentId: ali.id, score: 40 }, { studentId: hira.id, score: 90 }, { studentId: saad.id, score: 95 },
    ]);
    await examService.updateRows(fx.actor, isl.id, [
      { studentId: ali.id, score: 25 }, { studentId: hira.id, exempt: true }, { studentId: saad.id, absent: true },
    ]);

    const res = await examService.results(fx.actor, exam.id, { classId: fx.klass.id });
    const by = Object.fromEntries(res.rows.map((row) => [row.name.split(" ")[0], row]));
    expect(by.Ali).toMatchObject({ result: "Pass", grade: "E", obtained: 65, total: 150 });
    expect(by.Hira).toMatchObject({ result: "Pass", grade: "A+", total: 100, classRank: 1 });
    expect(by.Saad).toMatchObject({ result: "Fail", grade: "F", failedPapers: 1 });
    expect(res.rows[0].overallRank).toBeUndefined();

    await expect(examService.advance(fx.actor, exam.id)).rejects.toThrow(/0 of 2 mark sheets are submitted/);
    await examService.transition(fx.actor, eng.id, "submit");
    await examService.transition(fx.actor, isl.id, "submit");
    await examService.advance(fx.actor, exam.id);
    await examService.advance(fx.actor, exam.id);
    await expect(examService.removeExam(fx.actor, exam.id)).rejects.toThrow(/Archive it instead/);
    const archived = await examService.archiveExam(fx.actor, exam.id);
    expect(archived.status).toBe("Archived");
  });

  test("editing papers updates marks and schedule; a draft exam can be deleted", async () => {
    const fx = await buildSchool();
    const exam = await examService.create(fx.actor, {
      name: "Unit Test", examType: "Unit Test", sessionId: fx.session.id, startDate: "2026-11-01", endDate: "2026-11-15", papers: papers(fx),
    });
    await examService.updateExam(fx.actor, exam.id, { papers: papers(fx, { totalMarks: 75, passingMarks: 30, startTime: "10:00", endTime: "12:00" }) });
    const eng = await MarkSheets.findOne({ where: { fkExamId: exam.id, fkSubjectId: fx.english.id } });
    expect([Number(eng.totalMarks), Number(eng.passingMarks), String(eng.startTime).slice(0, 5)]).toEqual([75, 30, "10:00"]);
    const link = await ClassSubjects.findOne({ where: { fkClassId: fx.klass.id, fkSubjectId: fx.english.id } });
    expect(Number(link.defaultTotalMarks)).toBe(75);
    await examService.removeExam(fx.actor, exam.id);
    expect(await MarkSheets.count({ where: { fkExamId: exam.id } })).toBe(0);
  });

  test("a student admitted after scheduling gets a row on the draft sheet", async () => {
    const fx = await buildSchool();
    const exam = await examService.create(fx.actor, {
      name: "Late Admit", examType: "Unit Test", sessionId: fx.session.id, startDate: "2026-11-01", endDate: "2026-11-15", papers: papers(fx),
    });
    const late = await Students.create({
      fkSchoolId: fx.school.id, fkClassId: fx.klass.id, admissionNo: `PL-${Date.now()}`.slice(0, 20),
      firstName: "Late", lastName: "Joiner", gender: "Female", dateOfBirth: "2021-01-01", admissionDate: "2026-11-01", status: "Active",
    });
    const eng = await MarkSheets.findOne({ where: { fkExamId: exam.id, fkSubjectId: fx.english.id } });
    const sheet = await examService.getSheet(fx.actor, eng.id);
    expect(sheet.rows.map((row) => row.fkStudentId)).toContain(late.id);
    expect(sheet.rows).toHaveLength(4);
  });
});
