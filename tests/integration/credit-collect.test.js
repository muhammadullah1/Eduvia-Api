"use strict";

/**
 * Finance Step 5: student credit and the Collect Fee desk. Excess payments become
 * credit (not pre-paid months), credit is auto-applied when bills are generated and
 * optionally at collection, it is serialised by the per-student lock and never goes
 * negative, retries are idempotent, receipts carry the credit movements, and the
 * desk endpoints respect the role matrix and totals redaction.
 */
const app = require("../../app");
const { sequelize, StudentFeeMonths, StudentCreditLedger, FeePayments, AuditLogs } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeStudent, makeParent } = require("../helpers/school");
const { request } = require("../helpers/http");
const feeService = require("../../services/fee.service");
const classService = require("../../services/class.service");
const credit = require("../../services/credit_ledger.service");
const auditService = require("../../services/audit.service");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const actorOf = (u, schoolId, role = "super_admin") => ({ id: u.id, schoolId, role, email: u.email });
const months = async (studentId) =>
  (await StudentFeeMonths.findAll({ where: { fkStudentId: studentId }, order: [["month", "ASC"], ["id", "ASC"]] }))
    .map((r) => ({ month: r.month, paid: Number(r.paidAmount), status: r.status }));
const entries = (studentId) => StudentCreditLedger.findAll({ where: { fkStudentId: studentId }, order: [["id", "ASC"]] });

async function fixture(label) {
  const { school, session } = await makeSchool();
  const admin = await makeUser(school.id, "super_admin");
  const klass = await classService.create(school.id, { fkSessionId: session.id, grade: label, section: "A", label, monthlyFee: 1000, capacity: 30 });
  const kid = await makeStudent(school.id, klass.id);
  return { school, admin, actor: actorOf(admin, school.id), klass, kid };
}

beforeAll(() => sequelize.authenticate());
afterAll(() => sequelize.close());

describe("excess payments become credit", () => {
  test("overpayment clears open months and the rest is a Credit linked to the payment", async () => {
    const fx = await fixture("Over");
    const { receipt } = await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 2500, paidOn: "2026-05-10" });
    expect(await months(fx.kid.id)).toEqual([
      { month: "2026-04", paid: 1000, status: "Paid" },
      { month: "2026-05", paid: 1000, status: "Paid" },
    ]); // no future month is pre-paid any more
    const rows = await entries(fx.kid.id);
    expect(rows.map((r) => [r.entryType, Number(r.amount), r.fkPaymentId, r.source])).toEqual([["Credit", 500, receipt.id, "payment"]]);
    expect(receipt).toMatchObject({ amount: 2500, unallocatedAmount: 500, creditAdded: 500, creditAppliedTotal: 0, creditBalance: 500 });
    expect(await AuditLogs.count({ where: { fkSchoolId: fx.school.id, entityType: "student_credit" } })).toBe(1);
  });

  test("exact payment creates no credit; confirmPayment excess also goes to credit", async () => {
    const fx = await fixture("Exact");
    await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 2000, paidOn: "2026-05-10" });
    expect(await entries(fx.kid.id)).toHaveLength(0);
    const pending = await FeePayments.create({ fkSchoolId: fx.school.id, fkStudentId: fx.kid.id, receiptNo: `P-${Date.now()}`, amountPaid: 1300, paymentDate: "2026-06-02", status: "Pending" });
    await feeService.confirmPayment(fx.actor, pending.id);
    expect((await entries(fx.kid.id)).map((r) => [r.entryType, Number(r.amount), r.fkPaymentId])).toEqual([["Credit", 300, pending.id]]);
  });
});

describe("auto-apply", () => {
  test("generation applies credit to the new bills oldest first, linked to each month", async () => {
    const fx = await fixture("Gen");
    await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 3500, paidOn: "2026-05-10" });
    await feeService.generateMonths(fx.actor, { month: "2026-07", classId: fx.klass.id });
    expect((await months(fx.kid.id)).map((m) => m.paid)).toEqual([1000, 1000, 1000, 500]);
    const rows = await entries(fx.kid.id);
    const bills = await StudentFeeMonths.findAll({ where: { fkStudentId: fx.kid.id }, order: [["month", "ASC"]] });
    expect(rows.map((r) => [r.entryType, Number(r.amount), r.fkFeeMonthId])).toEqual([
      ["Credit", 1500, null], ["Applied", 1000, bills[2].id], ["Applied", 500, bills[3].id],
    ]);
    expect(await credit.balance(fx.school.id, fx.kid.id)).toBe(0);
    const audit = await AuditLogs.findOne({ where: { fkSchoolId: fx.school.id, entityType: "student_credit", action: { [require("sequelize").Op.like]: "applied credit%" } } });
    expect(audit.metadata.trigger).toBe("generation");
  });

  test("at collection: applyCredit spends existing credit first; without it credit is kept", async () => {
    const fx = await fixture("Desk");
    await feeService.generateMonths(fx.actor, { month: "2026-05", classId: fx.klass.id });
    await sequelize.transaction((t) => credit.addCredit(fx.actor, { studentId: fx.kid.id, amount: 700, source: "manual" }, { transaction: t }));

    const kept = await feeService.previewPayment(fx.actor, { studentId: fx.kid.id, amount: 500, paidOn: "2026-05-10" });
    expect(kept.allocation.creditAppliedTotal).toBe(0);

    const { receipt } = await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 500, paidOn: "2026-05-10", applyCredit: true });
    expect(receipt.creditApplied).toEqual([expect.objectContaining({ month: "2026-04", amount: 700 })]);
    expect(receipt.feeMonths.map((m) => [m.month, m.amount])).toEqual([["2026-04", 300], ["2026-05", 200]]);
    expect(receipt.creditBalance).toBe(0);
    const applied = (await entries(fx.kid.id)).filter((r) => r.entryType === "Applied");
    expect(applied.map((r) => r.fkPaymentId)).toEqual([receipt.id]);
  });
});

describe("safety", () => {
  test("preview runs the real allocation and writes nothing", async () => {
    const fx = await fixture("Prev");
    const count = async () => [await FeePayments.count({ where: { fkStudentId: fx.kid.id } }), await StudentFeeMonths.count({ where: { fkStudentId: fx.kid.id } }), (await entries(fx.kid.id)).length, (await sequelize.query("SELECT COUNT(*)::int AS n FROM fee_allocations a JOIN student_fee_months m ON m.id = a.fk_fee_month_id WHERE m.fk_student_id = :id", { replacements: { id: fx.kid.id }, type: sequelize.QueryTypes.SELECT }))[0].n, await AuditLogs.count({ where: { fkSchoolId: fx.school.id } })];
    const before = await count();
    const { allocation } = await feeService.previewPayment(fx.actor, { studentId: fx.kid.id, amount: 2600, paidOn: "2026-05-10", idempotencyKey: `prev-${fx.kid.id}` });
    expect(allocation.feeMonths.map((m) => m.amount)).toEqual([1000, 1000]);
    expect(allocation.creditAdded).toBe(600);
    expect(allocation.receiptNo).toBeNull();
    expect(await count()).toEqual(before);
    const real = await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 2600, paidOn: "2026-05-10", idempotencyKey: `prev-${fx.kid.id}` });
    expect(real.duplicate).toBe(false); // the preview did not burn the key
    // Bills the preview had to create were rolled back, so only their ids differ.
    const strip = (lines) => lines.map((l) => ({ month: l.month, label: l.label, feeType: l.feeType, amount: l.amount }));
    expect(strip(real.receipt.feeMonths)).toEqual(strip(allocation.feeMonths));
    expect(real.receipt.creditAdded).toBe(allocation.creditAdded);
  });

  test("concurrent collections spend credit exactly once and the balance never goes negative", async () => {
    const fx = await fixture("Race");
    await feeService.generateMonths(fx.actor, { month: "2026-08", classId: fx.klass.id });
    await sequelize.transaction((t) => credit.addCredit(fx.actor, { studentId: fx.kid.id, amount: 1000, source: "manual" }, { transaction: t }));
    await Promise.all(Array.from({ length: 6 }, () => feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 100, paidOn: "2026-08-10", applyCredit: true })));
    const rows = await entries(fx.kid.id);
    const applied = rows.filter((r) => r.entryType === "Applied").reduce((n, r) => n + Number(r.amount), 0);
    expect(applied).toBe(1000);
    expect(await credit.balance(fx.school.id, fx.kid.id)).toBe(0);
    expect((await months(fx.kid.id)).reduce((n, m) => n + m.paid, 0)).toBe(1600);
    let running = 0;
    for (const r of rows) { running += r.entryType === "Credit" ? Number(r.amount) : -Number(r.amount); expect(running).toBeGreaterThanOrEqual(0); }
    await expect(sequelize.transaction((t) => credit.applyCredit(fx.actor, { studentId: fx.kid.id, amount: 1, feeMonthId: null }, { transaction: t }))).rejects.toMatchObject({ statusCode: 422 });
  });

  test("retries with the same idempotency key (sequential and parallel) record one payment and one credit", async () => {
    const fx = await fixture("Idem");
    const body = { studentId: fx.kid.id, amount: 2400, paidOn: "2026-05-10", idempotencyKey: `idem-${fx.kid.id}` };
    const first = await feeService.recordPayment(fx.actor, body);
    const again = await feeService.recordPayment(fx.actor, body);
    expect(again).toMatchObject({ duplicate: true, receipt: { id: first.receipt.id, creditAdded: 400 } });
    const parallel = await Promise.all([1, 2, 3].map(() => feeService.recordPayment(fx.actor, { ...body, idempotencyKey: `par-${fx.kid.id}`, amount: 300 })));
    expect(new Set(parallel.map((r) => r.receipt.id)).size).toBe(1);
    expect(await FeePayments.count({ where: { fkStudentId: fx.kid.id } })).toBe(2);
    expect((await entries(fx.kid.id)).filter((r) => r.entryType === "Credit").map((r) => Number(r.amount))).toEqual([400, 300]);
  });
});

describe("ledger history, desk endpoints and permissions", () => {
  let fx;
  let tok;
  let adminReceipt;
  beforeAll(async () => {
    fx = await fixture("Desk HTTP");
    const acc = await makeUser(fx.school.id, "accountant");
    tok = {
      admin: tokenFor(fx.admin),
      acc: tokenFor(acc),
      ops: tokenFor(await makeUser(fx.school.id, "operations_manager")),
      teacher: tokenFor(await makeUser(fx.school.id, "teacher")),
      parent: tokenFor(await makeParent(fx.school.id, fx.kid.id)),
    };
    adminReceipt = (await feeService.recordPayment(fx.actor, { studentId: fx.kid.id, amount: 1200 })).receipt;
  });

  test("accountant collects with applyCredit over HTTP and gets the receipt", async () => {
    const res = await call(tok.acc, "POST", "/fees/payments", { studentId: fx.kid.id, amount: 50000, method: "Cash", applyCredit: true, idempotencyKey: `acc-${fx.kid.id}` });
    expect(res.status).toBe(201);
    expect(res.body.data.receipt.creditAdded).toBeGreaterThan(0);
    const preview = await call(tok.acc, "POST", "/fees/payments/preview", { studentId: fx.kid.id, amount: 100 });
    expect(preview.status).toBe(200);
    expect(preview.body.data.allocation.creditAdded).toBe(100); // everything is paid: all of it would be credit
  });

  test("student ledger lists every credit movement with a running balance", async () => {
    const res = await call(tok.acc, "GET", `/fees/students/${fx.kid.id}/ledger`);
    expect(res.status).toBe(200);
    const history = res.body.data.creditHistory;
    expect(history.map((h) => h.type)).toEqual(["Credit"]);
    expect(history[0].balanceAfter).toBe(res.body.data.summary.creditBalance);
    expect(history.every((h) => h.balanceAfter >= 0)).toBe(true);
    expect(history.find((h) => h.type === "Credit" && h.receiptNo)).toBeTruthy();
  });

  test("overview: super admin sees today's school collection, accountant only their own", async () => {
    const res = await call(tok.admin, "GET", "/fees/collect/overview");
    if (!res.body.data) throw new Error(JSON.stringify(res.body));
    const sa = res.body.data;
    expect(sa).toMatchObject({ totalStudents: 1, withOutstanding: 0 });
    expect(sa.todayCollection.amount).toBe(51200);
    expect(sa.myCollectionToday).toBeUndefined();
    const acc = (await call(tok.acc, "GET", "/fees/collect/overview")).body.data;
    expect(acc.todayCollection).toBeUndefined();
    expect(acc.myCollectionToday).toEqual({ receipts: 1, amount: 50000 });
    expect(JSON.stringify(acc)).not.toContain("51200");
  });

  test("search needs 2+ characters and finds by name or admission number", async () => {
    expect((await call(tok.acc, "GET", "/fees/collect/students?q=a")).status).toBe(400);
    const byNo = await call(tok.acc, "GET", `/fees/collect/students?q=${encodeURIComponent(fx.kid.admissionNo)}`);
    expect(byNo.body.data.map((s) => s.id)).toEqual([fx.kid.id]);
    const byName = await call(tok.admin, "GET", `/fees/collect/students?q=${encodeURIComponent(fx.kid.firstName.slice(0, 3))}`);
    expect(byName.body.data.map((s) => s.id)).toContain(fx.kid.id);
    expect(byName.body.data[0]).toHaveProperty("creditBalance");
  });

  test("context shows open bills and credit; an accountant sees only their own receipts", async () => {
    const acc = (await call(tok.acc, "GET", `/fees/collect/students/${fx.kid.id}`)).body.data;
    expect(acc.creditBalance).toBeGreaterThan(0);
    expect(acc.recentReceipts.map((r) => r.id)).not.toContain(adminReceipt.id);
    const sa = (await call(tok.admin, "GET", `/fees/collect/students/${fx.kid.id}`)).body.data;
    expect(sa.recentReceipts.map((r) => r.id)).toContain(adminReceipt.id);
    expect((await call(tok.acc, "GET", `/fees/payments/${adminReceipt.id}/receipt`)).status).toBe(404);
  });

  test.each(["ops", "teacher", "parent"])("%s gets 403 on every desk endpoint", async (who) => {
    for (const [method, path, body] of [
      ["GET", "/fees/collect/overview"],
      ["GET", "/fees/collect/students?q=ab"],
      ["GET", `/fees/collect/students/${fx.kid.id}`],
      ["POST", "/fees/payments/preview", { studentId: fx.kid.id, amount: 10 }],
      ["POST", "/fees/payments", { studentId: fx.kid.id, amount: 10 }],
    ]) {
      expect((await call(tok[who], method, path, body)).status).toBe(403);
    }
  });

  test("credit audit entries are hidden from roles without fee access", async () => {
    const ops = await makeUser(fx.school.id, "operations_manager");
    const viewer = { id: ops.id, schoolId: fx.school.id, role: "operations_manager" };
    const rows = await auditService.list(fx.school.id, { limit: 500 }, viewer);
    expect(rows.some((r) => r.entityType === "student_credit")).toBe(false);
    expect(await auditService.list(fx.school.id, { entityType: "student_credit" }, viewer)).toEqual([]);
  });
});
