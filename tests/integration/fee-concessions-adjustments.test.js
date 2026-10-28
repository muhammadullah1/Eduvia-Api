"use strict";

const app = require("../../app");
const { sequelize, StudentFeeMonths, AcademicSessions } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");
const classService = require("../../services/class.service");
const feeService = require("../../services/fee.service");
const settingsService = require("../../services/settings.service");
const { SETTING_KEYS } = require("../../constants");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("fee concessions and adjustments", () => {
  let school; let session; let futureSession; let klass; let tok; let admin; let acc; let student;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    acc = await makeUser(school.id, "accountant");
    tok = { admin: tokenFor(admin), acc: tokenFor(acc) };
    futureSession = await AcademicSessions.create({
      fkSchoolId: school.id,
      name: `Conc-${Date.now()}`,
      startDate: "2099-04-01",
      endDate: "2100-03-31",
      isCurrent: false,
    });
    klass = await classService.create(school.id, {
      fkSessionId: session.id,
      grade: "C",
      section: "1",
      label: "C1",
      monthlyTuitionFee: 1000,
      capacity: 40,
    });
    student = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01" });
    await settingsService.update(
      { id: admin.id, schoolId: school.id, role: "super_admin" },
      SETTING_KEYS.FEES,
      { concessionsEnabled: true },
    );
  });

  afterAll(() => sequelize.close());

  test("accountant can request; only SA approves; conflict blocks generate", async () => {
    const a = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id,
      sessionId: session.id,
      mode: "percent",
      value: 10,
      feeTypes: ["Tuition"],
      effectiveFrom: "2026-04-01",
      reason: "Merit scholarship request",
      category: "Scholarship",
    });
    expect(a.status).toBe(201);
    expect((await call(tok.acc, "POST", `/fee-concessions/${a.body.data.id}/submit`)).status).toBe(200);
    expect((await call(tok.acc, "POST", `/fee-concessions/${a.body.data.id}/approve`)).status).toBe(403);
    expect((await call(tok.admin, "POST", `/fee-concessions/${a.body.data.id}/approve`)).status).toBe(200);

    const b = await call(tok.admin, "POST", "/fee-concessions", {
      studentId: student.id,
      sessionId: session.id,
      mode: "fixed_discount",
      value: 100,
      feeTypes: ["Tuition"],
      effectiveFrom: "2026-04-01",
      reason: "Second overlapping concession",
      stackable: false,
    });
    await call(tok.admin, "POST", `/fee-concessions/${b.body.data.id}/submit`);
    await call(tok.admin, "POST", `/fee-concessions/${b.body.data.id}/approve`);

    const preview = await call(tok.admin, "POST", "/fees/months/preview", { month: "2026-11", classId: klass.id });
    expect(preview.status).toBe(200);
    expect(preview.body.data.concessionConflicts?.length).toBeGreaterThan(0);

    // Resolve: revoke second
    expect(
      (await call(tok.admin, "POST", `/fee-concessions/${b.body.data.id}/revoke`, { reason: "Resolve conflict for billing" })).status,
    ).toBe(200);

    const gen = await call(tok.admin, "POST", "/fees/months/generate", { month: "2026-11", classId: klass.id });
    expect([200, 201]).toContain(gen.status);
    const nov = await StudentFeeMonths.findOne({
      where: { fkStudentId: student.id, month: "2026-11", feeType: "Tuition" },
    });
    expect(Number(nov.baseAmount)).toBe(1000);
    expect(Number(nov.discountAmount)).toBe(100);
    expect(Number(nov.netAmount)).toBe(900);
    expect(Number(nov.collectibleAmount)).toBe(900);
  });

  test("adjustment ledger preserves net and updates collectible; rejects below paid", async () => {
    const bill = await StudentFeeMonths.findOne({
      where: { fkStudentId: student.id, month: "2026-11", feeType: "Tuition" },
    });
    const reqAdj = await call(tok.admin, "POST", `/fees/months/${bill.id}/adjustments`, {
      deltaCollectible: 200,
      reason: "Clerical undercharge correction",
    });
    expect(reqAdj.status).toBe(201);
    const approved = await call(tok.admin, "POST", `/fees/adjustments/${reqAdj.body.data.id}/approve`);
    expect(approved.status).toBe(200);
    await bill.reload();
    expect(Number(bill.netAmount)).toBe(900);
    expect(Number(bill.collectibleAmount)).toBe(1100);
    expect(Number(bill.adjustmentTotal)).toBe(200);

    await bill.update({ paidAmount: 1000, status: "Partially Paid" });
    const bad = await call(tok.admin, "POST", `/fees/months/${bill.id}/adjustments`, {
      deltaCollectible: -500,
      reason: "Would go below paid amount",
    });
    expect(bad.status).toBe(409);
    expect(bad.body.data.code).toBe("ADJUSTMENT_BELOW_PAID");
  });

  test("family must be verified for sibling concession approval", async () => {
    const sibling = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01" });
    const family = await call(tok.admin, "POST", "/families", {
      displayName: "Khan family",
      studentIds: [student.id, sibling.id],
    });
    // OPS manages families — SA also has families.manage
    expect(family.status).toBe(201);
    const conc = await call(tok.admin, "POST", "/fee-concessions", {
      studentId: sibling.id,
      sessionId: session.id,
      familyId: family.body.data.id,
      category: "Sibling",
      mode: "waiver",
      value: 100,
      feeTypes: ["Tuition"],
      effectiveFrom: "2026-04-01",
      reason: "Younger sibling waiver",
    });
    expect(conc.status).toBe(201);
    await call(tok.admin, "POST", `/fee-concessions/${conc.body.data.id}/submit`);
    const unverified = await call(tok.admin, "POST", `/fee-concessions/${conc.body.data.id}/approve`);
    expect(unverified.status).toBe(400);
    expect((await call(tok.admin, "POST", `/families/${family.body.data.id}/verify`)).status).toBe(200);
    expect((await call(tok.admin, "POST", `/fee-concessions/${conc.body.data.id}/approve`)).status).toBe(200);
    void futureSession;
  });

  test("fee type policy can block concessions", async () => {
    const policies = await call(tok.admin, "GET", "/settings/fee-type-policies");
    expect(policies.status).toBe(200);
    await call(tok.admin, "PUT", "/settings/fee-type-policies", {
      items: [{ feeType: "Admission", concessionEligible: false }],
    });
    const list = await call(tok.admin, "GET", "/settings/fee-type-policies");
    expect(list.body.data.find((p) => p.feeType === "Admission").concessionEligible).toBe(false);
  });
});
