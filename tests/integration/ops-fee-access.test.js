"use strict";

/**
 * Fee data is Super Admin + Accountant only (a parent sees their own child's).
 * The Operations Manager gets 403 on every fee endpoint, never sees an amount
 * embedded in a non-fee response (class fee, strike-off dues, audit metadata),
 * sees strike-off dues only as a yes/no flag, and reads the audit log
 * (read-only) without fee entries.
 */
const app = require("../../app");
const { sequelize, Classes } = require("../../models");
const { today } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const FEE_KEYS = /"(monthlyFee|monthlyTuitionFee|monthly_tuition_fee|fixedMonthlyFee|fixed_monthly_fee|outstandingAmount|outstanding_amount|financialStatus)"/;
const MONTH = today().slice(0, 7);

describe("operations manager fee access", () => {
  let school; let session; let klass; let student; let tok;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    const users = {
      admin: await makeUser(school.id, "super_admin"),
      ops: await makeUser(school.id, "operations_manager"),
      acc: await makeUser(school.id, "accountant"),
      teacher: await makeUser(school.id, "teacher"),
    };
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    klass = await makeClass(school.id, session.id, "Ops A");
    await Classes.update({ monthlyTuitionFee: 3000 }, { where: { id: klass.id } });
    student = await makeStudent(school.id, klass.id, { firstName: "Dues" });
    expect((await call(tok.admin, "POST", "/fees/months/generate", { month: MONTH })).status).toBe(201);
    expect((await call(tok.admin, "POST", "/fees/payments", { studentId: student.id, amount: 100, paidOn: today(), method: "Cash" })).status).toBe(201);
    const struck = await call(tok.admin, "POST", `/students/${student.id}/status`, {
      status: "StruckOff", reason: "Left", reasonCategory: "Transfer out", academicStatus: "In progress", effectiveOn: today(),
    });
    expect(struck.status).toBe(200);
  });

  it.each([
    ["GET", "/fees/months"], ["GET", "/fees/payments"], ["GET", "/fees/summary"], ["GET", "/fees/collections"],
    ["GET", "/fees/reports/daily"], ["GET", "/fees/import-template"], ["POST", "/fees/payments"], ["GET", "/expenses"],
  ])("refuses %s %s with 403", async (method, path) => {
    expect((await call(tok.ops, method, path, method === "POST" ? {} : undefined)).status).toBe(403);
  });

  it("hides the class fee from Ops but not from the Super Admin", async () => {
    const ops = await call(tok.ops, "GET", "/classes");
    expect(ops.status).toBe(200);
    expect(JSON.stringify(ops.body)).not.toMatch(FEE_KEYS);
    const one = await call(tok.ops, "GET", `/classes/${klass.id}`);
    expect(JSON.stringify(one.body)).not.toMatch(FEE_KEYS);
    const admin = await call(tok.admin, "GET", "/classes");
    expect(JSON.stringify(admin.body)).toMatch(/monthlyTuitionFee/);
  });

  it("ignores a class fee sent by Ops", async () => {
    const res = await call(tok.ops, "PATCH", `/classes/${klass.id}`, { monthlyFee: 1 });
    expect(res.status).toBe(200);
    expect(Number((await Classes.findByPk(klass.id)).monthlyTuitionFee)).toBe(3000);
  });

  it("shows strike-off dues to Ops only as a yes/no flag", async () => {
    const history = await call(tok.ops, "GET", `/students/lifecycle/history?studentId=${student.id}`);
    expect(history.status).toBe(200);
    expect(JSON.stringify(history.body)).not.toMatch(FEE_KEYS);
    const event = history.body.data.events.find((e) => e.type === "StruckOff" || e.toStatus === "StruckOff");
    expect(event.hasOutstanding).toBe(true);

    const timeline = await call(tok.ops, "GET", `/students/${student.id}/lifecycle`);
    expect(timeline.status).toBe(200);
    expect(timeline.body.data.outstanding).toBeNull();
    expect(timeline.body.data.hasOutstanding).toBe(true);
    expect(JSON.stringify(timeline.body)).not.toMatch(FEE_KEYS);

    const admin = await call(tok.admin, "GET", `/students/${student.id}/lifecycle`);
    expect(admin.body.data.outstanding).toBeGreaterThan(0);
    expect(admin.body.data.events.some((e) => e.outstandingAmount > 0)).toBe(true);
  });

  it("lets Ops read the audit log without fee entries; it stays read-only", async () => {
    const ops = await call(tok.ops, "GET", "/audit-logs?limit=200");
    expect(ops.status).toBe(200);
    const types = ops.body.data.map((row) => row.entityType);
    expect(types).not.toContain("fee_payment");
    expect(types).not.toContain("student_fee_month");
    expect(JSON.stringify(ops.body)).not.toMatch(FEE_KEYS);
    expect(types.length).toBeGreaterThan(0);
    const filtered = await call(tok.ops, "GET", "/audit-logs?entityType=fee_payment");
    expect(filtered.body.data).toEqual([]);

    const admin = await call(tok.admin, "GET", "/audit-logs?limit=200");
    expect(admin.body.data.map((row) => row.entityType)).toContain("fee_payment");

    for (const method of ["POST", "PATCH", "DELETE"]) {
      expect((await call(tok.ops, method, "/audit-logs", {})).status).toBeGreaterThanOrEqual(404);
    }
    expect((await call(tok.acc, "GET", "/audit-logs")).status).toBe(403);
    expect((await call(tok.teacher, "GET", "/audit-logs")).status).toBe(403);
  });
});
