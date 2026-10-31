"use strict";

/**
 * Staff dashboard (EDUVIA-16 Phase 2): permission-shaped widgets, server-side redaction,
 * reconciliation with the fee ledger, tenant isolation and the portal-role refusal.
 */
const app = require("../../app");
const { Op } = require("sequelize");
const { sequelize, Attendances, Classes, Roles, StudentFeeMonths } = require("../../models");
const dashboardService = require("../../services/dashboard.service");
const roleService = require("../../services/role.service");
const { today } = require("../../utils/dates");
const { actorFor, makeSchool, makeUser, makeClass, makeStudent, makeParent, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, path) => request(app, { method: "GET", path: `/api${path}`, token });
const MONEY_KEYS = /"(collected|expected|outstanding|amount|totalAmount|income|expenses|net|paidAgainstBills)"/;
const MONTH = today().slice(0, 7);

describe("staff dashboard", () => {
  let a;
  let b;

  async function seed() {
    const { school, session } = await makeSchool();
    const users = {
      admin: await makeUser(school.id, "super_admin"),
      ops: await makeUser(school.id, "operations_manager"),
      acc: await makeUser(school.id, "accountant"),
      teacher: await makeUser(school.id, "teacher"),
    };
    const klass = await makeClass(school.id, session.id, "Dash A", 1500);
    await Classes.create({ fkSchoolId: school.id, fkSessionId: session.id, grade: "Dash B", section: "A", label: "Dash B", capacity: 30 });
    const s1 = await makeStudent(school.id, klass.id, { firstName: "Ayesha" });
    const s2 = await makeStudent(school.id, klass.id, { firstName: "Bilal" });
    users.parent = await makeParent(school.id, s1.id);
    const tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    const gen = await request(app, { method: "POST", path: "/api/fees/months/generate", token: tok.acc, body: { month: MONTH } });
    expect(gen.status).toBe(201);
    const due = async (studentId) => StudentFeeMonths.sum("netAmount", { where: { fkStudentId: studentId, month: { [Op.lte]: MONTH } } });
    const paid = await due(s1.id);
    const pay = await request(app, { method: "POST", path: "/api/fees/payments", token: tok.acc, body: { studentId: s1.id, amount: paid, paidOn: today(), method: "Cash" } });
    expect(pay.status).toBe(201);
    await Attendances.bulkCreate([
      { fkSchoolId: school.id, fkClassId: klass.id, fkStudentId: s1.id, date: today(), status: "Present" },
      { fkSchoolId: school.id, fkClassId: klass.id, fkStudentId: s2.id, date: today(), status: "Absent" },
    ]);
    return { school, users, tok, s1, s2, paid, owed: await due(s2.id) };
  }

  beforeAll(async () => {
    await sequelize.authenticate();
    a = await seed();
    b = await seed();
  });

  beforeEach(() => dashboardService.clearCache());
  afterAll(() => sequelize.close());

  test("the Super Admin sees school finances that reconcile with the ledger", async () => {
    const res = await call(a.tok.admin, `/dashboard?period=${MONTH}`);
    expect(res.status).toBe(200);
    const { widgets, period } = res.body.data;
    expect(period.key).toBe(MONTH);
    expect(widgets.students.active).toBe(2);
    expect(widgets.attendance.today).toMatchObject({ marked: 2, present: 1, absent: 1, percent: 50 });
    expect(widgets.finance).toMatchObject({ collected: a.paid, expected: 3000, paidAgainstBills: 1500, collectionRate: 50, outstanding: a.owed });
    expect(widgets.finance.byMethod).toEqual([{ method: "Cash", amount: a.paid, receipts: 1 }]);
    expect(widgets.finance.defaulterClasses).toEqual([expect.objectContaining({ label: "Dash A", students: 1, amount: a.owed })]);
    expect(widgets.finance.defaulterStudents).toEqual([expect.objectContaining({ studentId: a.s2.id, name: expect.stringContaining("Bilal"), classLabel: "Dash A", months: expect.any(Number), amount: a.owed })]);
    expect(widgets.finance.advanceCredit).toEqual({ students: 0, amount: 0 });
    expect(widgets.finance.recentPayments).toHaveLength(1);
    expect(widgets.alerts.classesWithoutFeeStructure.map((c) => c.label)).toEqual(["Dash B"]);
    const rep = await call(a.tok.admin, `/finance/report?period=${MONTH}`);
    expect(widgets.incomeVsExpenses.income).toBe(rep.body.data.totals.income);
  });

  test("the Operations Manager gets academics and fee-cleared counts, never money", async () => {
    const res = await call(a.tok.ops, "/dashboard");
    expect(res.status).toBe(200);
    const { widgets } = res.body.data;
    expect(widgets.finance).toBeUndefined();
    expect(widgets.incomeVsExpenses).toBeUndefined();
    expect(widgets.attendance.trend).toEqual([{ date: today(), percent: 50, absent: 1 }]);
    expect(widgets.feeStatus).toMatchObject({ month: MONTH, cleared: 1, notCleared: 1 });
    expect(JSON.stringify(widgets)).not.toMatch(MONEY_KEYS);
  });

  test("the Accountant gets own receipt rows and counts only, no totals", async () => {
    const res = await call(a.tok.acc, "/dashboard");
    expect(res.status).toBe(200);
    const { widgets } = res.body.data;
    expect(Object.keys(widgets).sort()).toEqual(["generation", "myImports", "myReceiptsToday"]);
    expect(widgets.myReceiptsToday.rows).toHaveLength(1);
    expect(widgets.myReceiptsToday.totals).toBeUndefined();
    expect(widgets.generation).toMatchObject({ activeStudents: 2, billed: 2, notBilled: 0 });
    expect(JSON.stringify({ ...widgets, myReceiptsToday: undefined })).not.toMatch(MONEY_KEYS);
  });

  test("teachers and parents keep their own portals", async () => {
    expect((await call(a.tok.teacher, "/dashboard")).status).toBe(403);
    expect((await call(a.tok.parent, "/dashboard")).status).toBe(403);
  });

  test("schools are isolated", async () => {
    const res = await call(b.tok.admin, "/dashboard");
    expect(res.body.data.widgets.finance.recentPayments.map((p) => p.id)).not.toEqual(
      (await call(a.tok.admin, "/dashboard")).body.data.widgets.finance.recentPayments.map((p) => p.id),
    );
    expect(res.body.data.widgets.students.active).toBe(2);
  });

  test("a revoked permission drops its widget at once, despite the cache", async () => {
    const before = await dashboardService.dashboard(await actorFor(a.users.ops));
    expect(before.widgets.feeStatus).toBeDefined();
    const role = await Roles.findOne({ where: { fkSchoolId: a.school.id, key: "operations_manager" } });
    const detail = await roleService.get(a.school.id, role.id);
    const keep = detail.permissions.filter((p) => p.granted && p.key !== "students.manage").map((p) => p.key);
    await roleService.updatePermissions(await actorFor(a.users.admin), role.id, { permissions: keep, reason: "Dashboard redaction check", version: role.version });
    const after = await dashboardService.dashboard(await actorFor(a.users.ops));
    expect(after.widgets.feeStatus).toBeUndefined();
  });

  test("session, month, week and day presets cover today's payment; redaction is unchanged", async () => {
    for (const preset of ["day", "week", "month", "session"]) {
      const res = await call(a.tok.admin, `/dashboard?period=${preset}`);
      expect(res.status).toBe(200);
      const { period, widgets } = res.body.data;
      expect(period.kind).toBe(preset);
      expect(period.from <= today() && today() < period.to).toBe(true);
      expect(widgets.finance.collected).toBe(a.paid);
      expect(widgets.incomeVsExpenses.income).toBe(a.paid);
    }
    const ops = await call(a.tok.ops, "/dashboard?period=week");
    expect(ops.status).toBe(200);
    expect(JSON.stringify(ops.body.data.widgets)).not.toMatch(MONEY_KEYS);
    expect((await call(a.tok.admin, "/dashboard?period=year")).status).toBe(400);
  });

  test("an invalid period is rejected", async () => {
    expect((await call(a.tok.admin, "/dashboard?period=2026-13")).status).toBe(400);
  });
});
