"use strict";

/**
 * Fee structure API under session-lock policy: mutate freely before session
 * start (single live row per type); after start only bootstrap missing types.
 * Billing still honours historical effective_from rows already stored.
 */
const app = require("../../app");
const { sequelize, FeeStructures, StudentFeeMonths, AuditLogs, AcademicSessions } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");
const feeService = require("../../services/fee.service");
const classService = require("../../services/class.service");

const formClass = (schoolId, sessionId, label, fee = 1000) =>
  classService.create(schoolId, { fkSessionId: sessionId, grade: label, section: "A", label, monthlyFee: fee, capacity: 30 });

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("fee structure API", () => {
  let school; let currentSession; let futureSession; let futureClass; let other; let tok; let users;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session: currentSession } = await makeSchool());
    futureSession = await AcademicSessions.create({
      fkSchoolId: school.id,
      name: `FS-Future-${Date.now()}`,
      startDate: "2099-04-01",
      endDate: "2100-03-31",
      isCurrent: false,
    });
    users = {
      admin: await makeUser(school.id, "super_admin"),
      acc: await makeUser(school.id, "accountant"),
      ops: await makeUser(school.id, "operations_manager"),
      teacher: await makeUser(school.id, "teacher"),
      parent: await makeUser(school.id, "parent"),
    };
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    futureClass = await formClass(school.id, futureSession.id, "FS Future");
    const otherSchool = await makeSchool();
    other = await makeClass(otherSchool.school.id, otherSchool.session.id, "Other school");
  });

  afterAll(() => sequelize.close());

  test("a class created with a fee starts with a Tuition row from the session start", async () => {
    const res = await call(tok.admin, "GET", `/fee-structures/classes/${futureClass.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sessionLocked).toBe(false);
    expect(res.body.data.fees).toEqual([
      expect.objectContaining({ feeType: "Tuition", amount: 1000, frequency: "Monthly", effectiveFrom: "2099-04-01" }),
    ]);
  });

  test("adding one-time and yearly types on a future session", async () => {
    for (const [feeType, amount] of [["Admission", 5000], ["Exam", 800], ["Annual", 2500]]) {
      const res = await call(tok.admin, "POST", `/fee-structures/classes/${futureClass.id}`, { feeType, amount });
      expect(res.status).toBe(201);
      expect(res.body.data.effectiveFrom).toBe("2099-04-01");
    }
    const { body } = await call(tok.acc, "GET", `/fee-structures/classes/${futureClass.id}`);
    expect(body.data.fees.map((f) => [f.feeType, f.frequency])).toEqual([
      ["Tuition", "Monthly"],
      ["Admission", "OneTime"],
      ["Exam", "Yearly"],
      ["Annual", "Yearly"],
    ]);
    expect(body.data.monthlyTotal).toBe(1000);
    expect(body.data.otherTotal).toBe(8300);
  });

  test("pre-session change supersedes to a single live Tuition row", async () => {
    const res = await call(tok.admin, "POST", `/fee-structures/classes/${futureClass.id}`, { feeType: "Tuition", amount: 1200 });
    expect(res.status).toBe(201);
    const live = await FeeStructures.findAll({ where: { fkClassId: futureClass.id, feeType: "Tuition" } });
    expect(live).toHaveLength(1);
    expect(Number(live[0].amount)).toBe(1200);
    const hist = await call(tok.acc, "GET", `/fee-structures/classes/${futureClass.id}/history/Tuition`);
    expect(hist.body.data.entries.some((e) => e.status === "Removed")).toBe(true);
    expect(hist.body.data.entries.filter((e) => e.status === "Current")).toHaveLength(1);
  });

  test("fee generation still bills historical effective_from rows written directly", async () => {
    const klass = await formClass(school.id, currentSession.id, "FS Hist Bill", 1000);
    // Seed multi-dated history as legacy rows (API no longer creates mid-session dates).
    await FeeStructures.destroy({ where: { fkClassId: klass.id, feeType: "Tuition" } });
    await FeeStructures.bulkCreate([
      { fkSchoolId: school.id, fkSessionId: currentSession.id, fkClassId: klass.id, feeType: "Tuition", frequency: "Monthly", amount: 1000, effectiveFrom: "2026-04-01" },
      { fkSchoolId: school.id, fkSessionId: currentSession.id, fkClassId: klass.id, feeType: "Tuition", frequency: "Monthly", amount: 1200, effectiveFrom: "2026-09-01" },
      { fkSchoolId: school.id, fkSessionId: currentSession.id, fkClassId: klass.id, feeType: "Tuition", frequency: "Monthly", amount: 1500, effectiveFrom: "2026-10-15" },
    ]);
    const svc = require("../../services/fee_structure.service");
    expect(await svc.tuitionForMonth(klass.id, "2026-08")).toBe(1000);
    expect(await svc.tuitionForMonth(klass.id, "2026-09")).toBe(1200);
    expect(await svc.tuitionForMonth(klass.id, "2026-10")).toBe(1200);
    expect(await svc.tuitionForMonth(klass.id, "2026-11")).toBe(1500);

    const student = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01" });
    const actor = { id: users.admin.id, schoolId: school.id, role: "super_admin" };
    await feeService.generateMonths(actor, { month: "2026-11", classId: klass.id });
    const months = await StudentFeeMonths.findAll({
      where: { fkStudentId: student.id, month: ["2026-08", "2026-09", "2026-10", "2026-11"], feeType: "Tuition" },
      order: [["month", "ASC"]],
    });
    expect(months.map((m) => [m.month, Number(m.netAmount)])).toEqual([
      ["2026-08", 1000],
      ["2026-09", 1200],
      ["2026-10", 1200],
      ["2026-11", 1500],
    ]);
    expect(Number(months[0].collectibleAmount)).toBe(1000);
  });

  test("a missing or zero tuition structure does not bill a school fallback", async () => {
    const zero = await makeClass(school.id, currentSession.id, "Zero fee");
    await FeeStructures.destroy({ where: { fkClassId: zero.id, feeType: "Tuition" } });
    await FeeStructures.create({
      fkSchoolId: school.id,
      fkSessionId: currentSession.id,
      fkClassId: zero.id,
      feeType: "Tuition",
      frequency: "Monthly",
      amount: 0,
      effectiveFrom: "2026-04-01",
    });
    const student = await makeStudent(school.id, zero.id, { admissionDate: "2026-04-01" });
    const actor = { id: users.admin.id, schoolId: school.id, role: "super_admin" };
    const preview = await feeService.previewGeneration(actor, { month: "2026-05", classId: zero.id });
    expect(preview.missingStructures?.length).toBeGreaterThan(0);
    expect(preview.missingStructures[0].message).toMatch(/No fee structure for .* \/ Tuition/);
    expect(preview.canConfirm).toBe(false);
    expect(preview.totals.bills).toBe(0);

    await feeService.generateMonths(actor, { month: "2026-05", classId: zero.id });
    const may = await StudentFeeMonths.findAll({
      where: { fkStudentId: student.id, month: "2026-05", feeType: "Tuition" },
    });
    expect(may).toHaveLength(0);
  });

  test("editing the fee on a future-session class form records Tuition", async () => {
    const c2 = await formClass(school.id, futureSession.id, "FS B2", 1000);
    const res = await call(tok.admin, "PATCH", `/classes/${c2.id}`, { monthlyFee: 2222 });
    expect(res.status).toBe(200);
    const svc = require("../../services/fee_structure.service");
    expect(await svc.tuitionForMonth(c2.id, "2099-04")).toBe(2222);
  });

  test("remove needs a reason, archives rows, is audited", async () => {
    const noReason = await call(tok.admin, "DELETE", `/fee-structures/classes/${futureClass.id}/Exam`, {});
    expect(noReason.status).toBe(400);
    const res = await call(tok.admin, "DELETE", `/fee-structures/classes/${futureClass.id}/Exam`, {
      reason: "Exam fee merged into tuition",
    });
    expect(res.status).toBe(200);
    const { body } = await call(tok.admin, "GET", `/fee-structures/classes/${futureClass.id}`);
    expect(body.data.fees.map((f) => f.feeType)).not.toContain("Exam");
    const hist = await call(tok.admin, "GET", `/fee-structures/classes/${futureClass.id}/history/Exam`);
    expect(hist.body.data.entries[0]).toMatchObject({ status: "Removed", removedReason: "Exam fee merged into tuition" });
    const audit = await AuditLogs.findOne({
      where: { entityType: "fee_structure", action: { [require("sequelize").Op.like]: "removed Exam%" } },
    });
    expect(audit.action).toMatch(/Exam fee merged into tuition/);
  });

  test.each([
    [{ feeType: "Misc", amount: 300 }, /feeType/],
    [{ feeType: "Tuition", amount: 0 }, /amount/],
    [{ feeType: "Tuition", amount: -5 }, /amount/],
    [{ feeType: "Tuition", amount: 10.123 }, /amount/],
  ])("rejects invalid input %j", async (body, message) => {
    const res = await call(tok.admin, "POST", `/fee-structures/classes/${futureClass.id}`, body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(message);
  });

  test("scoped by school: another school's class is not found", async () => {
    expect((await call(tok.admin, "GET", `/fee-structures/classes/${other.id}`)).status).toBe(404);
    expect((await call(tok.admin, "POST", `/fee-structures/classes/${other.id}`, { feeType: "Exam", amount: 1 })).status).toBe(404);
  });

  test("permission matrix: SA edits, accountant reads only, Ops/teacher/parent get 403", async () => {
    const add = (t) => call(t, "POST", `/fee-structures/classes/${futureClass.id}`, { feeType: "Exam", amount: 900 });
    const del = (t) => call(t, "DELETE", `/fee-structures/classes/${futureClass.id}/Annual`, { reason: "role check only" });
    const get = (t) => call(t, "GET", `/fee-structures/classes/${futureClass.id}`);
    const hist = (t) => call(t, "GET", `/fee-structures/classes/${futureClass.id}/history/Tuition`);
    expect((await get(tok.acc)).status).toBe(200);
    expect((await hist(tok.acc)).status).toBe(200);
    expect((await add(tok.acc)).status).toBe(403);
    expect((await del(tok.acc)).status).toBe(403);
    for (const role of ["ops", "teacher", "parent"]) {
      for (const fn of [get, hist, add, del]) expect([role, (await fn(tok[role])).status]).toEqual([role, 403]);
    }
    expect((await add(tok.admin)).status).toBe(201);
  });
});
