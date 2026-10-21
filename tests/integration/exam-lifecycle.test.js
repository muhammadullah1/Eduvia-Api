"use strict";

const http = require("http");
const app = require("../../app");
const { Schools, AcademicSessions, Users, Subjects, Classes, Students, ClassSubjects, Exams, MarkSheets } = require("../../models");
const examService = require("../../services/exam.service");
const { USER_ROLES } = require("../../constants");
const { generateToken } = require("../../utils");
const { today } = require("../../utils/dates");

/** A date `days` away from today, as YYYY-MM-DD. */
function shift(days) {
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function buildSchool() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const school = await Schools.create({ name: `Lifecycle School ${stamp}`, email: `life-${stamp}@example.com`, code: `LS${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true,
  });
  const admin = await Users.create({
    fkSchoolId: school.id, firstName: "Ada", lastName: "Admin", email: `life-admin-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.SUPER_ADMIN, status: "active",
  });
  const english = await Subjects.create({ fkSchoolId: school.id, name: "English", code: `LE${stamp}`.slice(0, 20) });
  const islamiyat = await Subjects.create({ fkSchoolId: school.id, name: "Islamiyat", code: `LI${stamp}`.slice(0, 20) });
  const klass = await Classes.create({
    fkSchoolId: school.id, fkSessionId: session.id, grade: "KG", section: "Main", label: "KG", monthlyTuitionFee: 1000, capacity: 30,
  });
  await ClassSubjects.create({ fkClassId: klass.id, fkSubjectId: english.id, defaultTotalMarks: 100, defaultPassingMarks: 40 });
  await ClassSubjects.create({ fkClassId: klass.id, fkSubjectId: islamiyat.id, defaultTotalMarks: 50, defaultPassingMarks: 25 });
  const students = [];
  for (const [index, firstName] of ["Ali", "Hira", "Saad"].entries()) {
    students.push(await Students.create({
      fkSchoolId: school.id, fkClassId: klass.id, admissionNo: `L${index}-${stamp}`.slice(0, 20),
      firstName, lastName: "Khan", gender: "Male", dateOfBirth: "2021-01-01", admissionDate: "2026-04-01", status: "Active",
    }));
  }
  const actor = { id: admin.id, schoolId: school.id, role: admin.role, email: admin.email };
  return { school, session, actor, english, islamiyat, klass, students };
}

function papers(fx, englishDate, islamiyatDate) {
  return [
    { classId: fx.klass.id, subjectId: fx.english.id, totalMarks: 100, passingMarks: 40, paperDate: englishDate },
    { classId: fx.klass.id, subjectId: fx.islamiyat.id, totalMarks: 50, passingMarks: 25, paperDate: islamiyatDate },
  ];
}

/**
 * Schedule an exam, then move its dates so it lands in the wanted phase.
 * English sits on the first day and Islamiyat on the last.
 */
async function examIn(fx, name, startDate, endDate) {
  const created = await examService.create(fx.actor, {
    name, examType: "Mid-Term", sessionId: fx.session.id, startDate: shift(30), endDate: shift(40),
    papers: papers(fx, shift(30), shift(31)),
  });
  await Exams.update({ startDate, endDate }, { where: { id: created.id } });
  await MarkSheets.update({ paperDate: startDate }, { where: { fkExamId: created.id, fkSubjectId: fx.english.id } });
  await MarkSheets.update({ paperDate: endDate }, { where: { fkExamId: created.id, fkSubjectId: fx.islamiyat.id } });
  return created.id;
}

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        host: "127.0.0.1", port: server.address().port, path, method,
        headers: { Authorization: `Bearer ${token}`, platform: "webApp", "Content-Type": "application/json" },
      }, (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => { server.close(); resolve({ status: res.statusCode, body: JSON.parse(raw || "{}") }); });
      });
      req.on("error", (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe("exam lifecycle", () => {
  test("phase follows the dates and the result status", () => {
    expect(examService.examPhase({ status: "Scheduled", startDate: shift(2), endDate: shift(5) })).toBe("upcoming");
    expect(examService.examPhase({ status: "Scheduled", startDate: shift(-1), endDate: shift(2) })).toBe("ongoing");
    expect(examService.examPhase({ status: "Scheduled", startDate: today(), endDate: today() })).toBe("ongoing");
    expect(examService.examPhase({ status: "Marks Pending", startDate: shift(-9), endDate: shift(-2) })).toBe("past");
    expect(examService.examPhase({ status: "Published", startDate: shift(3), endDate: shift(5) })).toBe("past");
  });

  test("an upcoming exam can be edited and deleted, but not archived", async () => {
    const fx = await buildSchool();
    const id = await examIn(fx, "Upcoming", shift(10), shift(20));
    const edited = await examService.updateExam(fx.actor, id, { examType: "Final Term", startDate: shift(12) });
    expect(edited.examType).toBe("Final Term");
    await expect(examService.archiveExam(fx.actor, id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(examService.removeExam(fx.actor, id)).resolves.toEqual({ id });
  });

  test("an ongoing exam allows a rename, a later end date and new future papers only", async () => {
    const fx = await buildSchool();
    const id = await examIn(fx, "Ongoing", shift(-2), shift(5));
    await MarkSheets.update({ paperDate: shift(8) }, { where: { fkExamId: id, fkSubjectId: fx.islamiyat.id } });
    const [summary] = (await examService.listSummaries(fx.actor, { sessionId: fx.session.id })).exams;
    expect(summary.phase).toBe("ongoing");

    await expect(examService.removeExam(fx.actor, id)).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/in progress/) });
    await expect(examService.updateExam(fx.actor, id, { examType: "Final Term" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(examService.updateExam(fx.actor, id, { startDate: shift(-1) })).rejects.toMatchObject({ statusCode: 409 });
    await expect(examService.updateExam(fx.actor, id, { endDate: shift(3) })).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/extended/) });

    const renamed = await examService.updateExam(fx.actor, id, { name: "Ongoing (rescheduled)", endDate: shift(8) });
    expect(renamed.name).toBe("Ongoing (rescheduled)");
    expect(renamed.endDate).toBe(shift(8));

    // Existing papers must stay as they are.
    const current = papers(fx, shift(-2), shift(8));
    await expect(examService.updateExam(fx.actor, id, { papers: [{ ...current[0], totalMarks: 75 }, current[1]] }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/Existing papers/) });

    // A newly assigned subject can be added as a paper dated today or later, never in the past.
    const science = await Subjects.create({ fkSchoolId: fx.school.id, name: "Science", code: `LSC${Date.now()}`.slice(0, 20) });
    await ClassSubjects.create({ fkClassId: fx.klass.id, fkSubjectId: science.id, defaultTotalMarks: 100, defaultPassingMarks: 40 });
    const extra = (date) => ({ classId: fx.klass.id, subjectId: science.id, totalMarks: 100, passingMarks: 40, paperDate: date });
    await expect(examService.updateExam(fx.actor, id, { papers: [...current, extra(shift(-1))] }))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/today or later/) });
    const added = await examService.updateExam(fx.actor, id, { papers: [...current, extra(shift(1))] });
    expect(added.markSheets.length).toBe(3);
  });

  test("a past exam is archive-only, and the API answers 409 with a reason", async () => {
    const fx = await buildSchool();
    const id = await examIn(fx, "Past", shift(-10), shift(-3));
    const token = generateToken({ id: fx.actor.id, schoolId: fx.school.id, role: fx.actor.role, email: fx.actor.email }, "1h");

    const edit = await request("PATCH", `/api/exams/${id}`, token, { name: "Renamed" });
    expect(edit.status).toBe(409);
    expect(edit.body.message).toMatch(/has ended/);
    const remove = await request("DELETE", `/api/exams/${id}`, token);
    expect(remove.status).toBe(409);
    expect(remove.body.message).toMatch(/Archive it instead/);
    const archive = await request("POST", `/api/exams/${id}/archive`, token, {});
    expect(archive.status).toBe(200);
    expect(archive.body.data.status).toBe("Archived");
  });
});
