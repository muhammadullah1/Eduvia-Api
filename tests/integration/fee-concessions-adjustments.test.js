"use strict";

const app = require("../../app");
const { sequelize, StudentFeeMonths, SchoolConcessionReasons } = require("../../models");
const { actorFor, makeSchool, makeUser, tokenFor, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");
const classService = require("../../services/class.service");
const settingsService = require("../../services/settings.service");
const { SETTING_KEYS } = require("../../constants");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("fee concessions and adjustments (simplified)", () => {
  let school; let session; let klass; let tok; let admin; let acc; let student; let meritId;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    acc = await makeUser(school.id, "accountant");
    tok = { admin: tokenFor(admin), acc: tokenFor(acc) };
    klass = await classService.create(school.id, {
      fkSessionId: session.id,
      grade: "C",
      section: "1",
      label: "C1",
      monthlyFee: 1000,
      capacity: 40,
    });
    student = await makeStudent(school.id, klass.id, { admissionDate: "2026-04-01" });

    // Seed reasons for this school (migration seeds existing schools only).
    const reason = await SchoolConcessionReasons.create({
      fkSchoolId: school.id,
      label: "Merit",
      defaultMode: "percent",
      defaultValue: 10,
      sortOrder: 10,
      active: true,
    });
    meritId = reason.id;

    await settingsService.update(
      await actorFor(admin),
      SETTING_KEYS.FEES,
      {
        concessionPolicy: {
          allowedModes: ["percent", "fixed_discount", "waiver"],
          approvalRule: "threshold",
          approvalPercentAbove: 15,
          approvalAmountAbove: 200,
        },
      },
    );
  });

  afterAll(() => sequelize.close());

  test("within-policy concession activates immediately and bills with snapshot", async () => {
    const a = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id,
      sessionId: session.id,
      reasonId: meritId,
      mode: "percent",
      value: 10,
      feeType: "Tuition",
      effectiveFrom: "2026-04-01",
    });
    expect(a.status).toBe(201);
    expect(a.body.data.status).toBe("Approved");

    const gen = await call(tok.admin, "POST", "/fees/months/generate", {
      month: "2026-10",
      classId: klass.id,
    });
    expect([200, 201]).toContain(gen.status);
    const bill = await StudentFeeMonths.findOne({
      where: { fkStudentId: student.id, month: "2026-10", feeType: "Tuition" },
    });
    expect(Number(bill.baseAmount)).toBe(1000);
    expect(Number(bill.discountAmount)).toBe(100);
    expect(Number(bill.netAmount)).toBe(900);
    expect(bill.concessionSnapshot.reasonLabel).toBe("Merit");
    expect(bill.concessionSnapshot.mode).toBe("percent");
  });

  test("a second concession on the same fee type needs an explicit replace", async () => {
    const res = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id,
      reasonId: meritId,
      mode: "percent",
      value: 5,
      feeType: "Tuition",
      effectiveFrom: "2026-04-01",
    });
    expect(res.status).toBe(409);
  });

  test("above-threshold goes pending; SA approves and supersedes prior", async () => {
    const pending = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id,
      reasonId: meritId,
      mode: "percent",
      value: 40,
      feeType: "Tuition",
      effectiveFrom: "2026-04-01",
      replaceExisting: true,
    });
    expect(pending.status).toBe(201);
    expect(pending.body.data.status).toBe("PendingApproval");
    expect((await call(tok.acc, "POST", `/fee-concessions/${pending.body.data.id}/approve`)).status).toBe(403);
    expect((await call(tok.admin, "POST", `/fee-concessions/${pending.body.data.id}/approve`)).status).toBe(200);

    const list = await call(tok.admin, "GET", `/fee-concessions/students/${student.id}`);
    expect(list.status).toBe(200);
    const approved = list.body.data.filter((r) => r.status === "Approved");
    expect(approved).toHaveLength(1);
    expect(approved[0].value).toBe(40);
    expect(list.body.data.some((r) => r.status === "Superseded")).toBe(true);

    const bill = await StudentFeeMonths.findOne({
      where: { fkStudentId: student.id, month: "2026-10", feeType: "Tuition" },
    });
    expect(Number(bill.netAmount)).toBe(900);
  });

  test("a pending request blocks another one for the same fee type", async () => {
    const first = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id, reasonId: meritId, mode: "percent", value: 50,
      feeType: "Tuition", effectiveFrom: "2026-04-01", replaceExisting: true,
    });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("PendingApproval");
    const second = await call(tok.admin, "POST", "/fee-concessions", {
      studentId: student.id, reasonId: meritId, mode: "percent", value: 20,
      feeType: "Tuition", effectiveFrom: "2026-04-01", replaceExisting: true,
    });
    expect(second.status).toBe(409);
    expect((await call(tok.admin, "POST", `/fee-concessions/${first.body.data.id}/reject`, { reason: "Not eligible" })).status).toBe(200);
  });

  test("adjustment ledger preserves net and updates collectible; rejects below paid", async () => {
    const bill = await StudentFeeMonths.findOne({
      where: { fkStudentId: student.id, month: "2026-10", feeType: "Tuition" },
    });
    const before = Number(bill.collectibleAmount);
    const reqAdj = await call(tok.admin, "POST", `/fees/months/${bill.id}/adjustments`, {
      deltaCollectible: -50,
      reason: "Courtesy discount after review",
    });
    expect(reqAdj.status).toBe(201);
    const approved = await call(tok.admin, "POST", `/fees/adjustments/${reqAdj.body.data.id}/approve`);
    expect(approved.status).toBe(200);
    await bill.reload();
    expect(Number(bill.collectibleAmount)).toBe(before - 50);

    const pay = await call(tok.admin, "POST", "/fees/payments", {
      studentId: student.id,
      amount: Number(bill.collectibleAmount),
      method: "Cash",
      paidOn: "2026-10-15",
    });
    expect([200, 201]).toContain(pay.status);
    if (pay.body.data?.id) {
      await call(tok.admin, "POST", `/fees/payments/${pay.body.data.id}/confirm`);
    }
    await bill.reload();

    const tooLow = await call(tok.admin, "POST", `/fees/months/${bill.id}/adjustments`, {
      deltaCollectible: -Number(bill.collectibleAmount) - 1,
      reason: "Cannot go below paid amount",
    });
    expect([400, 409]).toContain(tooLow.status);
  });

  test("tenant isolation: school B cannot read school A concessions", async () => {
    const other = await makeSchool();
    const otherAdmin = await makeUser(other.school.id, "super_admin");
    const otherTok = tokenFor(otherAdmin);
    const list = await call(otherTok, "GET", `/fee-concessions/students/${student.id}`);
    expect([403, 404]).toContain(list.status);
    const approve = await call(otherTok, "POST", `/fee-concessions/1/approve`);
    expect([403, 404]).toContain(approve.status);
  });

  test("families write is gone", async () => {
    const res = await call(tok.admin, "POST", "/families", { displayName: "X", studentIds: [student.id] });
    expect(res.status).toBe(410);
  });
});
