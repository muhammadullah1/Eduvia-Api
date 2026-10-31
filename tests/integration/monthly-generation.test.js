"use strict";

/**
 * Finance Step 4: monthly generation and student ledgers. Effective-dated
 * amounts, fixed-fee overrides, separately billed fees (Admission, Annual,
 * Exam), duplicate protection (including concurrent runs), preview == generate,
 * audit history, the student ledger and the role matrix.
 */
const app = require("../../app");
const { sequelize, StudentFeeMonths, AuditLogs, AcademicSessions, FeeStructures } = require("../../models");
const { actorFor, makeSchool, makeUser, tokenFor, makeStudent, makeParent } = require("../helpers/school");
const { request } = require("../helpers/http");
const feeService = require("../../services/fee.service");
const classService = require("../../services/class.service");
const credit = require("../../services/credit_ledger.service");
const { FEE_TYPE_FREQUENCY } = require("../../constants/finance");

const formClass = (schoolId, sessionId, label, fee = 1000) =>
  classService.create(schoolId, { fkSessionId: sessionId, grade: label, section: "A", label, monthlyFee: fee, capacity: 30 });
const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

/** Seed structure rows directly (session lock blocks mid-session API writes). */
async function seedFee(fx, feeType, amount, effectiveFrom) {
  return FeeStructures.create({
    fkSchoolId: fx.school.id,
    fkSessionId: fx.session.id,
    fkClassId: fx.klass.id,
    feeType,
    frequency: FEE_TYPE_FREQUENCY[feeType],
    amount,
    effectiveFrom,
  });
}

const bills = async (studentId) =>
  (await StudentFeeMonths.findAll({ where: { fkStudentId: studentId }, order: [["month", "ASC"], ["id", "ASC"]] }))
    .map((r) => ({ month: r.month, type: r.feeType, due: Number(r.amountDue) }));
const countFor = (studentIds) => StudentFeeMonths.count({ where: { fkStudentId: studentIds }, paranoid: false });

async function fixture(label) {
  const { school, session } = await makeSchool();
  const admin = await makeUser(school.id, "super_admin");
  const klass = await formClass(school.id, session.id, label);
  return { school, session, admin, actor: await actorFor(admin), klass };
}

beforeAll(() => sequelize.authenticate());
afterAll(() => sequelize.close());

describe("amounts and effective dates", () => {
  test("each month uses the Tuition amount in force; Approved concession adjusts net", async () => {
    const fx = await fixture("Amounts");
    const regular = await makeStudent(fx.school.id, fx.klass.id);
    const discounted = await makeStudent(fx.school.id, fx.klass.id);
    const { SchoolConcessionReasons } = require("../../models");
    const feeConcessionService = require("../../services/fee_concession.service");
    const reason = await SchoolConcessionReasons.create({
      fkSchoolId: fx.school.id,
      label: "Hardship",
      defaultMode: "fixed_discount",
      defaultValue: 300,
      sortOrder: 1,
      active: true,
    });
    await feeConcessionService.assign(fx.actor, {
      studentId: discounted.id,
      reasonId: reason.id,
      mode: "fixed_discount",
      value: 300,
      feeType: "Tuition",
      effectiveFrom: "2026-04-01",
    });
    await seedFee(fx, "Tuition", 1200, "2026-07-01");
    await feeService.generateMonths(fx.actor, { month: "2026-08", classId: fx.klass.id });

    expect(await bills(regular.id)).toEqual(
      ["2026-04", "2026-05", "2026-06"].map((m) => ({ month: m, type: "Tuition", due: 1000 }))
        .concat(["2026-07", "2026-08"].map((m) => ({ month: m, type: "Tuition", due: 1200 }))),
    );
    expect((await bills(discounted.id)).map((b) => b.due)).toEqual([700, 700, 700, 900, 900]);
  });

  test("ledger starts at the admission month for students admitted mid-session", async () => {
    const fx = await fixture("Mid");
    const kid = await makeStudent(fx.school.id, fx.klass.id, { admissionDate: "2026-06-15" });
    await feeService.generateMonths(fx.actor, { month: "2026-07", classId: fx.klass.id });
    expect((await bills(kid.id)).map((b) => b.month)).toEqual(["2026-06", "2026-07"]);
  });
});

describe("separately billed fees", () => {
  test("Annual is billed once per session, in the first generated month it is in force", async () => {
    const fx = await fixture("Annual");
    await seedFee(fx, "Annual", 3000, "2026-04-01");
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-05", classId: fx.klass.id });
    await feeService.generateMonths(fx.actor, { month: "2027-03", classId: fx.klass.id });
    const annual = (await bills(kid.id)).filter((b) => b.type === "Annual");
    expect(annual).toEqual([{ month: "2026-04", type: "Annual", due: 3000 }]);

    // Next session: billed again once.
    await AcademicSessions.create({ fkSchoolId: fx.school.id, name: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31", isCurrent: false });
    await feeService.generateMonths(fx.actor, { month: "2027-06", classId: fx.klass.id });
    expect((await bills(kid.id)).filter((b) => b.type === "Annual").map((b) => b.month)).toEqual(["2026-04", "2027-04"]);
  });

  test("Annual added mid-session is not back-filled into existing months", async () => {
    const fx = await fixture("AnnualLate");
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-06", classId: fx.klass.id });
    await seedFee(fx, "Annual", 2500, "2026-04-01");
    await feeService.generateMonths(fx.actor, { month: "2026-06", classId: fx.klass.id });
    expect((await bills(kid.id)).some((b) => b.type === "Annual")).toBe(false);
    await feeService.generateMonths(fx.actor, { month: "2026-07", classId: fx.klass.id });
    expect((await bills(kid.id)).filter((b) => b.type === "Annual")).toEqual([{ month: "2026-07", type: "Annual", due: 2500 }]);
  });

  test("Exam is billed in the month its effective row starts (or the month after a mid-month date)", async () => {
    const fx = await fixture("Exam");
    await seedFee(fx, "Exam", 800, "2026-06-01");
    await seedFee(fx, "Exam", 900, "2026-09-15");
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-12", classId: fx.klass.id });
    expect((await bills(kid.id)).filter((b) => b.type === "Exam")).toEqual([
      { month: "2026-06", type: "Exam", due: 800 },
      { month: "2026-10", type: "Exam", due: 900 },
    ]);
  });

  test("Admission is billed once for new admissions only, never retroactively", async () => {
    const fx = await fixture("Adm");
    const existing = await makeStudent(fx.school.id, fx.klass.id);
    await seedFee(fx, "Admission", 5000, "2026-04-01")
    const fresh = await makeStudent(fx.school.id, fx.klass.id, { admissionDate: "2026-05-10" });
    await feeService.generateMonths(fx.actor, { month: "2026-07", classId: fx.klass.id });
    await feeService.generateMonths(fx.actor, { month: "2026-08", classId: fx.klass.id });
    expect((await bills(existing.id)).some((b) => b.type === "Admission")).toBe(false);
    expect((await bills(fresh.id)).filter((b) => b.type === "Admission")).toEqual([{ month: "2026-05", type: "Admission", due: 5000 }]);
  });

  test("zero-amount extras are not billed", async () => {
    const fx = await fixture("Zero");
    await seedFee(fx, "Annual", 0, "2026-04-01")
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-04", classId: fx.klass.id });
    expect((await bills(kid.id)).map((b) => b.type)).toEqual(["Tuition"]);
  });
});

describe("duplicates, preview and audit", () => {
  test("re-running is idempotent and concurrent runs never duplicate a bill", async () => {
    const fx = await fixture("Dup");
    await seedFee(fx, "Annual", 3000, "2026-04-01")
    await seedFee(fx, "Exam", 500, "2026-05-01")
    const kids = await Promise.all([1, 2, 3].map(() => makeStudent(fx.school.id, fx.klass.id)));
    const ids = kids.map((k) => k.id);

    const runs = await Promise.all([
      ...[1, 2, 3, 4].map(() => feeService.generateMonths(fx.actor, { month: "2026-06", classId: fx.klass.id })),
      feeService.generateMonths(fx.actor, { month: "2026-06" }),
      feeService.previewGeneration(fx.actor, { month: "2026-06" }),
    ]);
    // 3 students x (3 Tuition + 1 Annual + 1 Exam)
    expect(await countFor(ids)).toBe(15);
    const created = runs.slice(0, 5).reduce((n, r) => n + r.totals.bills, 0);
    expect(created).toBe(15);

    const again = await feeService.generateMonths(fx.actor, { month: "2026-06", classId: fx.klass.id });
    expect(again.totals.bills).toBe(0);
    expect(again.totals.skippedStudents).toBe(3);
    expect(await countFor(ids)).toBe(15);

    const [dupes] = await sequelize.query(
      `SELECT fk_student_id, month, fee_type, count(*) c FROM student_fee_months WHERE fk_student_id IN (:ids)
       GROUP BY 1,2,3 HAVING count(*) > 1`, { replacements: { ids } });
    expect(dupes).toEqual([]);
  });

  test("the database refuses a duplicate bill even outside the service", async () => {
    const fx = await fixture("DbKey");
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-04", classId: fx.klass.id });
    await expect(StudentFeeMonths.create({
      fkSchoolId: fx.school.id, fkStudentId: kid.id, month: "2026-04", feeType: "Tuition", amountDue: 1000, dueDate: "2026-04-10",
    })).rejects.toThrow();
  });

  test("preview writes nothing and matches what generation then creates", async () => {
    const fx = await fixture("Prev");
    const second = await formClass(fx.school.id, fx.session.id, "Prev B", 1500);
    await seedFee(fx, "Exam", 600, "2026-05-01")
    const kids = [
      await makeStudent(fx.school.id, fx.klass.id),
      await makeStudent(fx.school.id, fx.klass.id),
      await makeStudent(fx.school.id, second.id),
    ];
    const ids = kids.map((k) => k.id);
    const auditsBefore = await AuditLogs.count({ where: { fkSchoolId: fx.school.id } });

    const preview = await feeService.previewGeneration(fx.actor, { month: "2026-05" });
    expect(await countFor(ids)).toBe(0);
    expect(await AuditLogs.count({ where: { fkSchoolId: fx.school.id } })).toBe(auditsBefore);
    expect(preview.dryRun).toBe(true);

    const result = await feeService.generateMonths(fx.actor, { month: "2026-05" });
    const strip = (r) => r.classes.map(({ classId, students, bills, totalDue, byType }) => ({ classId, students, bills, totalDue, byType }));
    expect(strip(result)).toEqual(strip(preview));
    expect(result.totals.totalDue).toBe(preview.totals.totalDue);
    // A: 2 students × (2 months × 1000 + Exam 600); B: 1 student × 2 × 1500
    expect(preview.totals.totalDue).toBe(2 * (2000 + 600) + 3000);
    expect(await countFor(ids)).toBe(preview.totals.bills);

    const audit = await AuditLogs.findOne({ where: { fkSchoolId: fx.school.id }, order: [["id", "DESC"]] });
    expect(audit.description || audit.action || "").toBeTruthy();
    expect(JSON.stringify(audit.toJSON())).toMatch(/2026-05/);
    expect(await AuditLogs.count({ where: { fkSchoolId: fx.school.id } })).toBe(auditsBefore + 1);
  });

  test("preview reports outstanding carried from earlier months", async () => {
    const fx = await fixture("Carry");
    await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-05", classId: fx.klass.id });
    const preview = await feeService.previewGeneration(fx.actor, { month: "2026-06", classId: fx.klass.id });
    expect(preview.totals.outstandingCarried).toBe(2000);
    expect(preview.totals.totalDue).toBe(1000);
  });
});

describe("student ledger", () => {
  test("months, payments (oldest first), statuses and credit balance are accurate", async () => {
    const fx = await fixture("Ledger");
    await seedFee(fx, "Exam", 500, "2026-04-01")
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-06", classId: fx.klass.id });
    await feeService.recordPayment(fx.actor, { studentId: kid.id, amount: 1800, method: "Cash" });
    await credit.addCredit(fx.actor, { studentId: kid.id, amount: 250, source: "manual" });

    const ledger = await feeService.studentLedger(fx.actor, kid.id);
    // Recording a payment brings the ledger up to the current month (Apr..Oct 2026 tuition + April exam).
    const months = ledger.months.length;
    expect(ledger.summary).toEqual(expect.objectContaining({
      totalDue: months * 1000 + 500, totalPaid: 1800, outstanding: months * 1000 + 500 - 1800, creditBalance: 250,
      netBalance: months * 1000 + 500 - 1800 - 250,
    }));
    const apr = ledger.months.find((m) => m.month === "2026-04");
    // Oldest first: April Tuition (created first) then April Exam, then May.
    expect(apr).toEqual(expect.objectContaining({ due: 1500, paid: 1500, outstanding: 0, status: "Paid" }));
    const may = ledger.months.find((m) => m.month === "2026-05");
    expect(may).toEqual(expect.objectContaining({ due: 1000, paid: 300, outstanding: 700, status: "Partially Paid" }));
    expect(may.bills[0]).toEqual(expect.objectContaining({ feeType: "Tuition", due: 1000, paid: 300, outstanding: 700 }));
    expect(ledger.student.id).toBe(kid.id);
  });

  test("a month with an unpaid extra bill is not counted as paid", async () => {
    const fx = await fixture("MonthPaid");
    await seedFee(fx, "Exam", 500, "2026-04-01")
    const kid = await makeStudent(fx.school.id, fx.klass.id);
    await feeService.generateMonths(fx.actor, { month: "2026-04", classId: fx.klass.id });
    await feeService.recordPayment(fx.actor, { studentId: kid.id, amount: 1000, method: "Cash" });
    const tuition = await StudentFeeMonths.findOne({ where: { fkStudentId: kid.id, feeType: "Tuition" } });
    const exam = await StudentFeeMonths.findOne({ where: { fkStudentId: kid.id, feeType: "Exam" } });
    expect(Number(tuition.amountPaid)).toBe(1000);
    expect(Number(exam.amountPaid)).toBe(0);
    const ledger = await feeService.studentLedger(fx.actor, kid.id);
    expect(ledger.months[0].status).not.toBe("Paid");
  });
});

describe("role matrix", () => {
  let fx; let kid; let tok; let parentTok; let otherParentTok;
  beforeAll(async () => {
    fx = await fixture("Roles");
    kid = await makeStudent(fx.school.id, fx.klass.id);
    const other = await makeStudent(fx.school.id, fx.klass.id);
    const mk = async (role) => tokenFor(await makeUser(fx.school.id, role));
    tok = { admin: tokenFor(fx.admin), acc: await mk("accountant"), ops: await mk("operations_manager"), teacher: await mk("teacher") };
    parentTok = tokenFor(await makeParent(fx.school.id, kid.id));
    otherParentTok = tokenFor(await makeParent(fx.school.id, other.id));
  });

  test("Ops, Teacher and Parent cannot preview or generate", async () => {
    for (const t of [tok.ops, tok.teacher, parentTok]) {
      expect((await call(t, "POST", "/fees/months/preview", { month: "2026-05" })).status).toBe(403);
      expect((await call(t, "POST", "/fees/months/generate", { month: "2026-05" })).status).toBe(403);
    }
    expect(await countFor([kid.id])).toBe(0);
  });

  test("Super Admin sees money totals; Accountant gets counts only", async () => {
    const sa = await call(tok.admin, "POST", "/fees/months/preview", { month: "2026-05" });
    expect(sa.status).toBe(200);
    expect(sa.body.data.totals.totalDue).toBe(4000);
    const acc = await call(tok.acc, "POST", "/fees/months/preview", { month: "2026-05" });
    expect(acc.status).toBe(200);
    expect(acc.body.data.amountsHidden).toBe(true);
    expect(acc.body.data.totals.totalDue).toBeUndefined();
    expect(acc.body.data.classes[0].totalDue).toBeUndefined();
    expect(acc.body.data.totals.bills).toBe(4);
    const gen = await call(tok.acc, "POST", "/fees/months/generate", { month: "2026-05" });
    expect([200, 201]).toContain(gen.status);
    expect(gen.body.data.totals.bills).toBe(4);
    expect(await countFor([kid.id])).toBe(2);
  });

  test("ledger: SA, Accountant and the student's parent may read; Ops, Teacher, other parents may not", async () => {
    const path = `/fees/students/${kid.id}/ledger`;
    for (const t of [tok.admin, tok.acc, parentTok]) {
      const res = await call(t, "GET", path);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalDue).toBe(2000);
    }
    for (const t of [tok.ops, tok.teacher]) expect((await call(t, "GET", path)).status).toBe(403);
    expect([403, 404]).toContain((await call(otherParentTok, "GET", path)).status);
    expect((await call(tok.admin, "GET", "/fees/students/abc/ledger")).status).toBe(400);
  });

  test("invalid month is rejected", async () => {
    expect((await call(tok.admin, "POST", "/fees/months/preview", { month: "Oct-26" })).status).toBe(400);
  });
});
