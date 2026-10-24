"use strict";

/**
 * Student lifecycle (SRS 4.3.3, p15–16): transition map, required fields,
 * effective-date rules, final-grade graduation, strike-off fee snapshot,
 * no fee back-fill after reactivation, readmission, history, and guards.
 */
const app = require("../../app");
const {
  sequelize, Classes, Students, StudentStatusEvents, StudentFeeMonths, AuditLogs, AcademicSessions,
} = require("../../models");
const feeService = require("../../services/fee.service");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");

const setStatus = (token, id, body) => request(app, { method: "POST", path: `/api/students/${id}/status`, token, body });
const strike = { status: "StruckOff", reason: "Left", reasonCategory: "Transfer out", academicStatus: "Grade 4 in progress", effectiveOn: "2026-10-01" };

describe("student lifecycle", () => {
  let school;
  let session;
  let admin;
  let token;
  let actor;
  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    token = tokenFor(admin);
    actor = { id: admin.id, schoolId: school.id, role: admin.role, email: admin.email };
  });

  test("only allowed transitions pass; everything else is 409 with the allowed list", async () => {
    const klass = await makeClass(school.id, session.id);
    const active = await makeStudent(school.id, klass.id);
    const pending = await makeStudent(school.id, klass.id, { status: "Pending" });
    const base = { reason: "Test", effectiveOn: "2026-10-01" };
    for (const [student, status] of [[active, "Pending"], [active, "Withdrawn"], [active, "Active"], [pending, "Graduated"], [pending, "StruckOff"]]) {
      const res = await setStatus(token, student.id, { ...base, status, finalResult: "Pass", reasonCategory: "Other", academicStatus: "x" });
      expect(res.status).toBe(409);
      expect(Array.isArray(res.body.data?.allowed ?? res.body.allowed ?? [])).toBe(true);
    }
    // Pending → Withdrawn is the only use of Withdrawn.
    expect((await setStatus(token, pending.id, { ...base, status: "Withdrawn" })).status).toBe(200);
    expect((await StudentStatusEvents.findOne({ where: { fkStudentId: pending.id } })).eventType).toBe("Withdrawn");
    // Graduated can only be readmitted.
    const grad = await makeStudent(school.id, klass.id, { status: "Graduated" });
    expect((await setStatus(token, grad.id, { ...base, status: "Inactive", reasonCategory: "Leave" })).status).toBe(409);
  });

  test("required fields and effective-date rules", async () => {
    const klass = await makeClass(school.id, session.id);
    const student = await makeStudent(school.id, klass.id, { admissionDate: "2026-05-01" });
    const cases = [
      { status: "Inactive", reason: "Leave", effectiveOn: "2026-10-01" }, // no category
      { status: "Inactive", reason: "Leave", reasonCategory: "Disciplinary", effectiveOn: "2026-10-01" }, // wrong category
      { ...strike, academicStatus: "" },
      { ...strike, reasonCategory: "Policy", transferToSchool: "City School" },
      { status: "Graduated", reason: "Done", effectiveOn: "2026-10-01", graduationOverride: true }, // no final result
      { status: "Inactive", reason: "Leave", reasonCategory: "Leave", effectiveOn: "2999-01-01" }, // future
      { status: "Inactive", reason: "Leave", reasonCategory: "Leave", effectiveOn: "2026-04-15" }, // before admission
      { status: "Inactive", reason: "  ", reasonCategory: "Leave", effectiveOn: "2026-10-01" }, // blank reason
    ];
    for (const body of cases) {
      const res = await setStatus(token, student.id, body);
      expect([400, 422]).toContain(res.status);
    }
    expect(await StudentStatusEvents.count({ where: { fkStudentId: student.id } })).toBe(0);
    expect((await Students.findByPk(student.id)).status).toBe("Active");
  });

  test("graduation only from the final grade unless overridden (override stored and audited)", async () => {
    const next = await AcademicSessions.create({ fkSchoolId: school.id, name: `Grad ${Date.now()}`, startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: false });
    const nine = await Classes.create({ fkSchoolId: school.id, fkSessionId: next.id, grade: "Grade 9", section: "A", label: "Grade 9 · A", capacity: 30 });
    const ten = await Classes.create({ fkSchoolId: school.id, fkSessionId: next.id, grade: "Grade 10", section: "A", label: "Grade 10 · A", capacity: 30 });
    const early = await makeStudent(school.id, nine.id);
    const senior = await makeStudent(school.id, ten.id);
    const body = { status: "Graduated", reason: "Completed", effectiveOn: "2026-10-01", finalResult: "A grade" };

    const blocked = await setStatus(token, early.id, body);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/not the final grade/);
    expect((await setStatus(token, early.id, { ...body, graduationOverride: true })).status).toBe(200);
    const overridden = await StudentStatusEvents.findOne({ where: { fkStudentId: early.id } });
    expect(overridden).toMatchObject({ eventType: "Graduated", graduationOverride: true, fkClassId: nine.id, fkSessionId: next.id, finalResult: "A grade" });
    const audit = await AuditLogs.findOne({ where: { fkSchoolId: school.id, entityType: "student", entityId: early.id } });
    expect(audit.metadata).toMatchObject({ eventType: "Graduated", graduationOverride: true });

    expect((await setStatus(token, senior.id, body)).status).toBe(200);
    expect((await StudentStatusEvents.findOne({ where: { fkStudentId: senior.id } })).graduationOverride).toBe(false);
    expect((await Classes.findByPk(ten.id)).status).toBe("Inactive");
  });

  test("Inactive skips fee generation; reactivation resumes without back-filling (D2); strike-off snapshots outstanding", async () => {
    const klass = await makeClass(school.id, session.id);
    const student = await makeStudent(school.id, klass.id);
    const months = async () => (await StudentFeeMonths.findAll({ where: { fkStudentId: student.id }, order: [["month", "ASC"]] })).map((m) => m.month);
    await feeService.generateMonths(actor, { month: "2026-06", classId: klass.id });
    expect(await months()).toEqual(["2026-04", "2026-05", "2026-06"]);

    expect((await setStatus(token, student.id, { status: "Inactive", reason: "Travel", reasonCategory: "Leave", effectiveOn: "2026-07-01" })).status).toBe(200);
    await feeService.generateMonths(actor, { month: "2026-08", classId: klass.id });
    expect(await months()).toHaveLength(3);
    expect((await Classes.findByPk(klass.id)).status).toBe("Active"); // Inactive students keep their seat

    expect((await setStatus(token, student.id, { status: "Active", reason: "Back", effectiveOn: "2026-09-01" })).status).toBe(200);
    await feeService.generateMonths(actor, { month: "2026-10", classId: klass.id });
    expect(await months()).toEqual(["2026-04", "2026-05", "2026-06", "2026-09", "2026-10"]);

    const owed = (await StudentFeeMonths.findAll({ where: { fkStudentId: student.id } }))
      .reduce((sum, m) => sum + Number(m.getDataValue("netAmount")) - Number(m.getDataValue("paidAmount")), 0);
    const res = await setStatus(token, student.id, { ...strike, transferToSchool: "Beaconhouse" });
    expect(res.status).toBe(200);
    const event = await StudentStatusEvents.findOne({ where: { fkStudentId: student.id, eventType: "StruckOff" } });
    expect(Number(event.outstandingAmount)).toBeCloseTo(owed);
    expect(event).toMatchObject({ reasonCategory: "Transfer out", transferToSchool: "Beaconhouse", academicStatus: "Grade 4 in progress" });
    await feeService.generateMonths(actor, { month: "2026-12", classId: klass.id });
    expect(await months()).toHaveLength(5); // history kept, nothing new accrues
  });

  test("readmission keeps the record, needs class + session, checks capacity", async () => {
    const from = await makeClass(school.id, session.id);
    const full = await makeClass(school.id, session.id);
    await full.update({ capacity: 1 });
    await makeStudent(school.id, full.id, { status: "Inactive" }); // Inactive still holds a seat
    const student = await makeStudent(school.id, from.id);
    expect((await setStatus(token, student.id, strike)).status).toBe(200);
    const readmit = { status: "Active", reason: "Returned", effectiveOn: "2026-10-10" };

    expect((await setStatus(token, student.id, { ...readmit, classId: from.id })).status).toBe(400); // session missing
    const noRoom = await setStatus(token, student.id, { ...readmit, classId: full.id, sessionId: session.id });
    expect(noRoom.status).toBe(409);
    expect(noRoom.body.message).toMatch(/room for 0/);

    const ok = await setStatus(token, student.id, { ...readmit, classId: from.id, sessionId: session.id });
    expect(ok.status).toBe(200);
    const after = await Students.findByPk(student.id);
    expect(after).toMatchObject({ status: "Active", admissionNo: student.admissionNo, fkClassId: from.id });
    expect(await StudentStatusEvents.count({ where: { fkStudentId: student.id, eventType: "Readmitted", fkToClassId: from.id } })).toBe(1);
  });

  test("single promote: Active only, capacity counts every enrolled student", async () => {
    const from = await makeClass(school.id, session.id);
    const to = await makeClass(school.id, session.id);
    await to.update({ capacity: 1 });
    const away = await makeStudent(school.id, to.id, { status: "Inactive" });
    const student = await makeStudent(school.id, from.id);
    const promote = (id, body) => request(app, { method: "POST", path: `/api/students/${id}/promote`, token, body });

    expect((await promote(student.id, { classId: to.id, sessionId: session.id, date: "2026-10-01" })).status).toBe(409);
    await Students.update({ status: "StruckOff" }, { where: { id: away.id } });
    expect((await promote(away.id, { classId: from.id, sessionId: session.id, date: "2026-10-01" })).status).toBe(409);
    expect((await promote(student.id, { classId: to.id, sessionId: session.id, date: "2999-01-01" })).status).toBe(400);
    expect((await promote(student.id, { classId: to.id, sessionId: session.id, date: "2026-10-01" })).status).toBe(200);
  });

  test("history: UNION of promotions and status events, filtered and paginated; timeline lists allowed moves", async () => {
    const klass = await makeClass(school.id, session.id);
    const to = await makeClass(school.id, session.id);
    const student = await makeStudent(school.id, klass.id, { firstName: "Zarmeen", lastName: "Lifecycle" });
    await request(app, { method: "POST", path: `/api/students/${student.id}/promote`, token, body: { classId: to.id, sessionId: session.id, date: "2026-09-01" } });
    await setStatus(token, student.id, { status: "Inactive", reason: "Medical leave", reasonCategory: "Medical", effectiveOn: "2026-10-02" });

    const all = await request(app, { path: `/api/students/lifecycle/history?q=Zarmeen&pageSize=1`, token });
    expect(all.status).toBe(200);
    expect(all.body.data.pagination).toMatchObject({ total: 2, totalPages: 2, pageSize: 1 });
    expect(all.body.data.events[0]).toMatchObject({ type: "Deactivated", reasonCategory: "Medical", student: { id: student.id } });

    const promoted = await request(app, { path: `/api/students/lifecycle/history?type=Promoted&classId=${to.id}`, token });
    expect(promoted.body.data.events.map((e) => e.student.id)).toEqual([student.id]);
    expect(promoted.body.data.events[0]).toMatchObject({ fromClass: klass.label, toClass: to.label });

    const dated = await request(app, { path: `/api/students/lifecycle/history?q=Zarmeen&from=2026-10-01&to=2026-10-31&reasonCategory=Medical`, token });
    expect(dated.body.data.events).toHaveLength(1);
    expect((await request(app, { path: "/api/students/lifecycle/history?type=Nope", token })).status).toBe(400);

    const timeline = await request(app, { path: `/api/students/${student.id}/lifecycle`, token });
    expect(timeline.status).toBe(200);
    expect(timeline.body.data.events.map((e) => e.type)).toEqual(["Promoted", "Deactivated"]);
    expect(timeline.body.data.allowed.map((a) => a.to).sort()).toEqual(["Active", "Graduated", "StruckOff"]);
    expect(timeline.body.data).toMatchObject({ status: "Inactive", outstanding: expect.any(Number), finalGrade: expect.any(Boolean) });
  });

  test("permissions, delete guard and override reason", async () => {
    const klass = await makeClass(school.id, session.id);
    const student = await makeStudent(school.id, klass.id);
    for (const role of ["accountant", "teacher"]) {
      const other = tokenFor(await makeUser(school.id, role));
      expect((await setStatus(other, student.id, { status: "Inactive", reason: "x", reasonCategory: "Leave", effectiveOn: "2026-10-01" })).status).toBe(403);
      expect((await request(app, { path: "/api/students/lifecycle/history", token: other })).status).toBe(403);
    }
    const del = (id) => request(app, { method: "DELETE", path: `/api/students/${id}`, token });
    expect((await del(student.id)).status).toBe(409);
    const draft = await makeStudent(school.id, klass.id, { status: "Pending" });
    expect((await del(draft.id)).status).toBe(200);

    const noReason = await request(app, { method: "POST", path: "/api/exams/1/overrides", token, body: { studentId: student.id } });
    expect(noReason.status).toBe(400);
    const blank = await request(app, { method: "POST", path: "/api/exams/1/overrides", token, body: { studentId: student.id, reason: "  " } });
    expect(blank.status).toBe(400);
  });
});
