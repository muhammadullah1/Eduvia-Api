"use strict";

/**
 * Finance Step 3: fee structure API. Types, effective-dated history, removal
 * with reason, validation, the role matrix and fee generation using the
 * amount in force for each month.
 */
const app = require("../../app");
const { sequelize, Classes, FeeStructures, StudentFeeMonths, AuditLogs } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");
const feeService = require("../../services/fee.service");
const classService = require("../../services/class.service");

// Through the class service (the class form's path), so the fee structure hook runs.
const formClass = (schoolId, sessionId, label) =>
  classService.create(schoolId, { fkSessionId: sessionId, grade: label, section: "A", label, monthlyTuitionFee: 1000, capacity: 30 });

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("fee structure API", () => {
  let school; let session; let klass; let other; let tok; let users;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    users = {
      admin: await makeUser(school.id, "super_admin"),
      acc: await makeUser(school.id, "accountant"),
      ops: await makeUser(school.id, "operations_manager"),
      teacher: await makeUser(school.id, "teacher"),
      parent: await makeUser(school.id, "parent"),
    };
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    klass = await formClass(school.id, session.id, "FS A"); // class form fee 1000 -> Tuition row from session start
    const otherSchool = await makeSchool();
    other = await makeClass(otherSchool.school.id, otherSchool.session.id, "Other school");
  });

  afterAll(() => sequelize.close());

  test("a class created with a fee starts with a Tuition row from the session start", async () => {
    const res = await call(tok.admin, "GET", `/fee-structures/classes/${klass.id}?asOf=2026-05-01`);
    expect(res.status).toBe(200);
    expect(res.body.data.fees).toEqual([expect.objectContaining({ feeType: "Tuition", amount: 1000, frequency: "Monthly", effectiveFrom: "2026-04-01" })]);
    expect(res.body.data.monthlyTotal).toBe(1000);
  });

  test("adding one-time and yearly types keeps them out of the monthly total", async () => {
    for (const [feeType, amount] of [["Admission", 5000], ["Exam", 800], ["Annual", 2500]]) {
      const res = await call(tok.admin, "POST", `/fee-structures/classes/${klass.id}`, { feeType, amount, effectiveFrom: "2026-04-01" });
      expect(res.status).toBe(201);
    }
    const { body } = await call(tok.acc, "GET", `/fee-structures/classes/${klass.id}?asOf=2026-05-01`);
    expect(body.data.fees.map((f) => [f.feeType, f.frequency])).toEqual([["Tuition", "Monthly"], ["Admission", "OneTime"], ["Exam", "Yearly"], ["Annual", "Yearly"]]);
    expect(body.data.monthlyTotal).toBe(1000);
    expect(body.data.otherTotal).toBe(8300);
  });

  test("a new amount adds a row; history keeps the old one and marks the current one", async () => {
    const res = await call(tok.admin, "POST", `/fee-structures/classes/${klass.id}`, { feeType: "Tuition", amount: 1200, effectiveFrom: "2026-09-01" });
    expect(res.status).toBe(201);
    const dup = await call(tok.admin, "POST", `/fee-structures/classes/${klass.id}`, { feeType: "Tuition", amount: 1300, effectiveFrom: "2026-09-01" });
    expect(dup.status).toBe(409);
    const rows = await FeeStructures.findAll({ where: { fkClassId: klass.id, feeType: "Tuition" }, order: [["effectiveFrom", "ASC"]] });
    expect(rows.map((r) => [r.effectiveFrom, Number(r.amount)])).toEqual([["2026-04-01", 1000], ["2026-09-01", 1200]]);
    const hist = await call(tok.acc, "GET", `/fee-structures/classes/${klass.id}/history/Tuition`);
    expect(hist.status).toBe(200);
    const entries = hist.body.data.entries;
    expect(entries.map((e) => e.amount)).toEqual([1200, 1000]);
    expect(entries.filter((e) => e.status === "Current")).toHaveLength(1);
    const audit = await AuditLogs.findOne({ where: { entityType: "fee_structure", entityId: res.body.data.id } });
    expect(audit.action).toMatch(/changed Tuition .* from 1000 to 1200 effective 2026-09-01/);
  });

  test("effective lookup uses the latest row on or before the 1st of the month", async () => {
    await call(tok.admin, "POST", `/fee-structures/classes/${klass.id}`, { feeType: "Tuition", amount: 1500, effectiveFrom: "2026-10-15" });
    const svc = require("../../services/fee_structure.service");
    expect(await svc.tuitionForMonth(klass.id, "2026-08")).toBe(1000);
    expect(await svc.tuitionForMonth(klass.id, "2026-09")).toBe(1200);
    expect(await svc.tuitionForMonth(klass.id, "2026-10")).toBe(1200); // 15 Oct starts from November
    expect(await svc.tuitionForMonth(klass.id, "2026-11")).toBe(1500);
    expect(await svc.tuitionForMonth(klass.id, "2026-03")).toBeNull(); // before the first row: legacy fallback applies
  });

  test("fee generation bills each month with the amount in force; the student override wins", async () => {
    const student = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01" });
    const fixed = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01", fixedMonthlyFee: 700 });
    const actor = { id: users.admin.id, schoolId: school.id, role: "super_admin" };
    await feeService.generateMonths(actor, { month: "2026-11", classId: klass.id });
    const months = await StudentFeeMonths.findAll({ where: { fkStudentId: student.id, month: ["2026-08", "2026-09", "2026-10", "2026-11"] }, order: [["month", "ASC"]] });
    expect(months.map((m) => [m.month, Number(m.netAmount)])).toEqual([["2026-08", 1000], ["2026-09", 1200], ["2026-10", 1200], ["2026-11", 1500]]);
    const fixedMonths = await StudentFeeMonths.findAll({ where: { fkStudentId: fixed.id, month: "2026-11" } });
    expect(Number(fixedMonths[0].netAmount)).toBe(700);
  });

  test("a 0 tuition row (backfilled from a class with no fee) still bills the school default", async () => {
    const zero = await makeClass(school.id, session.id, "Zero fee");
    await Classes.update({ monthlyTuitionFee: 0 }, { where: { id: zero.id }, hooks: false });
    await FeeStructures.create({ fkSchoolId: school.id, fkSessionId: session.id, fkClassId: zero.id, feeType: "Tuition", frequency: "Monthly", amount: 0, effectiveFrom: "2026-04-01" });
    const student = await makeStudent(school.id, zero.id, { admissionDate: "2026-04-01" });
    const settings = await require("../../services/settings.service").get(school.id, require("../../constants").SETTING_KEYS.FEES);
    expect(Number(settings.defaultMonthlyFee)).toBeGreaterThan(0);
    const actor = { id: users.admin.id, schoolId: school.id, role: "super_admin" };
    await feeService.generateMonths(actor, { month: "2026-05", classId: zero.id });
    const [may] = await StudentFeeMonths.findAll({ where: { fkStudentId: student.id, month: "2026-05" } });
    expect(Number(may.netAmount)).toBe(Number(settings.defaultMonthlyFee));
  });

  test("the class fee column follows the tuition in force this month", async () => {
    const svc = require("../../services/fee_structure.service");
    const expected = await svc.tuitionForMonth(klass.id, require("../../utils/dates").today());
    expect(Number((await Classes.findByPk(klass.id)).monthlyTuitionFee)).toBe(expected);
  });

  test("editing the fee on the class form records a Tuition row (old flow keeps working)", async () => {
    const c2 = await formClass(school.id, session.id, "FS B");
    const res = await call(tok.admin, "PATCH", `/classes/${c2.id}`, { monthlyFee: 2222 });
    expect(res.status).toBe(200);
    const svc = require("../../services/fee_structure.service");
    expect(await svc.tuitionForMonth(c2.id, require("../../utils/dates").today())).toBe(2222);
  });

  test("remove needs a reason, archives every row, is audited and keeps history", async () => {
    const noReason = await call(tok.admin, "DELETE", `/fee-structures/classes/${klass.id}/Exam`, {});
    expect(noReason.status).toBe(400);
    const res = await call(tok.admin, "DELETE", `/fee-structures/classes/${klass.id}/Exam`, { reason: "Exam fee merged into tuition" });
    expect(res.status).toBe(200);
    const { body } = await call(tok.admin, "GET", `/fee-structures/classes/${klass.id}?asOf=2026-05-01`);
    expect(body.data.fees.map((f) => f.feeType)).not.toContain("Exam");
    const hist = await call(tok.admin, "GET", `/fee-structures/classes/${klass.id}/history/Exam`);
    expect(hist.body.data.entries[0]).toMatchObject({ status: "Removed", removedReason: "Exam fee merged into tuition" });
    const audit = await AuditLogs.findOne({ where: { entityType: "fee_structure", action: { [require("sequelize").Op.like]: "removed Exam%" } } });
    expect(audit.action).toMatch(/Exam fee merged into tuition/);
    expect((await call(tok.admin, "DELETE", `/fee-structures/classes/${klass.id}/Exam`, { reason: "again please" })).status).toBe(404);
  });

  test.each([
    [{ feeType: "Misc", amount: 300, effectiveFrom: "2026-04-01" }, /feeType/],
    [{ feeType: "Tuition", amount: 0, effectiveFrom: "2026-04-01" }, /amount/],
    [{ feeType: "Tuition", amount: -5, effectiveFrom: "2026-04-01" }, /amount/],
    [{ feeType: "Tuition", amount: 10.123, effectiveFrom: "2026-04-01" }, /amount/],
    [{ feeType: "Tuition", amount: 100, effectiveFrom: "2026-02-30" }, /real calendar date/],
    [{ feeType: "Tuition", amount: 100 }, /effectiveFrom/],
  ])("rejects invalid input %j", async (body, message) => {
    const res = await call(tok.admin, "POST", `/fee-structures/classes/${klass.id}`, body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(message);
  });

  test("scoped by school: another school's class is not found", async () => {
    expect((await call(tok.admin, "GET", `/fee-structures/classes/${other.id}`)).status).toBe(404);
    expect((await call(tok.admin, "POST", `/fee-structures/classes/${other.id}`, { feeType: "Exam", amount: 1, effectiveFrom: "2026-04-01" })).status).toBe(404);
  });

  test("permission matrix: SA edits, accountant reads only, Ops/teacher/parent get 403", async () => {
    const add = (t) => call(t, "POST", `/fee-structures/classes/${klass.id}`, { feeType: "Exam", amount: 900, effectiveFrom: "2026-12-01" });
    const del = (t) => call(t, "DELETE", `/fee-structures/classes/${klass.id}/Annual`, { reason: "role check only" });
    const get = (t) => call(t, "GET", `/fee-structures/classes/${klass.id}`);
    const hist = (t) => call(t, "GET", `/fee-structures/classes/${klass.id}/history/Tuition`);
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
