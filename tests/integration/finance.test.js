"use strict";

/**
 * Finance (Step 8): other income + expenses CRUD with validation and audit,
 * report sums for a month / FY quarter / FY, reconciliation of fee income with
 * the fee payments and the monthly fee report, permissions (accountant: own
 * expenses only, no totals; Ops / teacher / parent: 403) and the exports.
 */
const XLSX = require("xlsx");
const app = require("../../app");
const { sequelize, Teachers, Subjects } = require("../../models");
const { today } = require("../../utils/dates");
const { parsePeriod, currentPeriods } = require("../../utils/finance_period");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent, uid } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const raw = (token, path) => requestRaw(app, { path: `/api${path}`, token });
const q = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;

const TODAY = today();
const CUR = currentPeriods(TODAY);
const MONTH = CUR.month.slice(0, 7);
/** A day in the month `n` months before this one. */
const monthsAgo = (n, dayOfMonth = "10") => {
  const d = new Date(`${MONTH}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return `${d.toISOString().slice(0, 7)}-${dayOfMonth}`;
};

describe("finance", () => {
  let school; let tok; let users; let s1; let s2;
  const dates = { now: TODAY, m1: monthsAgo(1), m4: monthsAgo(4), m13: monthsAgo(13) };

  beforeAll(async () => {
    await sequelize.authenticate();
    let session;
    ({ school, session } = await makeSchool());
    users = {
      admin: await makeUser(school.id, "super_admin"),
      acc: await makeUser(school.id, "accountant"),
      acc2: await makeUser(school.id, "accountant"),
      ops: await makeUser(school.id, "operations_manager"),
      teacherUser: await makeUser(school.id, "teacher"),
    };
    const subject = await Subjects.create({ fkSchoolId: school.id, name: "Maths", code: `M${uid()}`.slice(0, 20) });
    await Teachers.create({ fkSchoolId: school.id, fkUserId: users.teacherUser.id, fkSubjectId: subject.id, employeeCode: `E${uid()}`.slice(0, 20) });
    const cls = await makeClass(school.id, session.id, "Fin A");
    s1 = await makeStudent(school.id, cls.id, { firstName: "Hira" });
    s2 = await makeStudent(school.id, cls.id, { firstName: "Omar" });
    users.parent = await makeParent(school.id, s1.id);
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    tok.teacher = tok.teacherUser;

    expect((await call(tok.admin, "POST", "/fees/months/generate", { month: MONTH })).status).toBe(201);
    const pay = async (token, studentId, amount, paidOn) => {
      const res = await call(token, "POST", "/fees/payments", { studentId, amount, paidOn, method: "Cash" });
      expect(res.status).toBe(201);
    };
    await pay(tok.acc, s1.id, 1200, dates.now);
    await pay(tok.admin, s2.id, 800.5, dates.now);
    await pay(tok.admin, s1.id, 300, dates.m1);
    await pay(tok.admin, s2.id, 450, dates.m4);
    await pay(tok.admin, s1.id, 999, dates.m13);
    // A Pending (unconfirmed) and an archived payment never count as income.
    await sequelize.query(
      `UPDATE fee_payments SET status = 'Pending' WHERE id = (SELECT id FROM fee_payments WHERE fk_school_id = :sid AND payment_date = :d ORDER BY id DESC LIMIT 1)`,
      { replacements: { sid: school.id, d: dates.m13 } },
    );
  });

  // ---- other income ----------------------------------------------------

  let donationId;
  test("Super Admin records, edits and soft-deletes other income, all audited", async () => {
    const bad = await call(tok.admin, "POST", "/finance/income", { category: "FeeIncome", amount: 0, date: "2026-02-30", description: "" });
    expect(bad.status).toBe(400);
    const future = await call(tok.admin, "POST", "/finance/income", { category: "Donation", amount: 10, date: "2999-01-01", description: "Future" });
    expect(future.status).toBe(400);

    const made = await call(tok.admin, "POST", "/finance/income", { category: "Donation", amount: 5000, date: dates.now, description: "Alumni donation", referenceNo: "DN-1" });
    expect(made.status).toBe(201);
    expect(made.body.data).toMatchObject({ category: "Donation", categoryLabel: "Donation", amount: 5000, reference: "DN-1", locked: false, source: "other" });
    donationId = made.body.data.entryId;
    expect((await call(tok.admin, "POST", "/finance/income", { category: "Grant", amount: 2500.25, date: dates.m1, description: "Govt grant" })).status).toBe(201);
    expect((await call(tok.admin, "POST", "/finance/income", { category: "Misc", amount: 100, date: dates.m4, description: "Hall rent" })).status).toBe(201);
    expect((await call(tok.admin, "POST", "/finance/income", { category: "Misc", amount: 7777, date: dates.m13, description: "Old year" })).status).toBe(201);

    const edited = await call(tok.admin, "PATCH", `/finance/income/${donationId}`, { amount: 5200 });
    expect(edited.status).toBe(200);
    expect(edited.body.data.amount).toBe(5200);

    const temp = await call(tok.admin, "POST", "/finance/income", { category: "Misc", amount: 999, date: dates.now, description: "Entered twice" });
    const noReason = await call(tok.admin, "DELETE", `/finance/income/${temp.body.data.entryId}`, {});
    expect(noReason.status).toBe(400);
    expect((await call(tok.admin, "DELETE", `/finance/income/${temp.body.data.entryId}`, { reason: "Duplicate entry" })).status).toBe(200);
    const [archived] = await q("SELECT archived_at, archive_reason, fk_archived_by_user_id FROM other_incomes WHERE id = :id", { id: temp.body.data.entryId });
    expect(archived.archived_at).not.toBeNull();
    expect(archived.archive_reason).toBe("Duplicate entry");
    expect(archived.fk_archived_by_user_id).toBe(users.admin.id);

    const logs = await q("SELECT action, metadata FROM audit_logs WHERE fk_school_id = :sid AND entity_type = 'other_income' ORDER BY id", { sid: school.id });
    expect(logs.some((l) => l.action.startsWith("recorded income \"Alumni donation\""))).toBe(true);
    const upd = logs.find((l) => l.action.startsWith("updated income"));
    expect(upd.metadata.changes.amount).toEqual({ from: "5000.00", to: 5200 });
    const del = logs.find((l) => l.action.startsWith("deleted income"));
    expect(del.metadata.reason).toBe("Duplicate entry");
  });

  test("income list merges locked fee receipts with other income for the month", async () => {
    const res = await call(tok.admin, "GET", `/finance/income?period=${MONTH}`);
    expect(res.status).toBe(200);
    const { rows, totals } = res.body.data;
    const fees = rows.filter((r) => r.source === "fee");
    expect(fees).toHaveLength(2);
    expect(fees.every((r) => r.locked && r.paymentId && r.category === "FeeIncome")).toBe(true);
    expect(fees[0].description).toMatch(/^Fee collection — /);
    expect(totals).toMatchObject({ fee: 2000.5, other: 5200, total: 7200.5, receipts: 2 });
    expect(rows.find((r) => r.description === "Entered twice")).toBeUndefined();
  });

  // ---- expenses ----------------------------------------------------------

  test("expenses: validation, create by Super Admin and accountant, edit/delete audited", async () => {
    expect((await call(tok.admin, "POST", "/expenses", { category: "Food", amount: 10, date: dates.now, description: "x" })).status).toBe(400);
    expect((await call(tok.admin, "POST", "/expenses", { category: "Utilities", amount: -5, date: dates.now, description: "Power" })).status).toBe(400);
    expect((await call(tok.admin, "POST", "/expenses", { category: "Utilities", amount: 5, date: "2999-01-01", description: "Power" })).status).toBe(400);

    const add = (token, body) => call(token, "POST", "/expenses", body);
    const salary = await add(tok.admin, { category: "StaffSalary", amount: 3000, date: dates.now, description: "October salaries", referenceNo: "PAY-10", paymentMethod: "BankTransfer" });
    expect(salary.status).toBe(201);
    expect(salary.body.data).toMatchObject({ category: "StaffSalary", categoryLabel: "Staff Salary", referenceNo: "PAY-10", paymentMethod: "BankTransfer" });
    expect((await add(tok.acc, { category: "Supplies", amount: 450.75, date: dates.now, description: "Chalk and markers" })).status).toBe(201);
    expect((await add(tok.acc2, { category: "Utilities", amount: 1200, date: dates.now, description: "Electricity bill" })).status).toBe(201);
    expect((await add(tok.admin, { category: "Maintenance", amount: 600, date: dates.m1, description: "Fan repair" })).status).toBe(201);
    expect((await add(tok.admin, { category: "Other", amount: 50, date: dates.m4, description: "Courier" })).status).toBe(201);
    expect((await add(tok.admin, { category: "Other", amount: 4444, date: dates.m13, description: "Last year" })).status).toBe(201);

    const id = salary.body.data.id;
    expect((await call(tok.acc, "PATCH", `/expenses/${id}`, { amount: 1 })).status).toBe(403);
    expect((await call(tok.acc, "DELETE", `/expenses/${id}`, { reason: "nope" })).status).toBe(403);
    expect((await call(tok.admin, "PATCH", `/expenses/${id}`, { amount: 3100, description: "October staff salaries" })).status).toBe(200);
    const dup = await add(tok.admin, { category: "Other", amount: 75, date: dates.now, description: "Typo entry" });
    expect((await call(tok.admin, "DELETE", `/expenses/${dup.body.data.id}`, {})).status).toBe(400);
    expect((await call(tok.admin, "DELETE", `/expenses/${dup.body.data.id}`, { reason: "Wrong amount" })).status).toBe(200);

    const logs = await q("SELECT action, metadata FROM audit_logs WHERE fk_school_id = :sid AND entity_type = 'expense' ORDER BY id", { sid: school.id });
    expect(logs.filter((l) => l.action.startsWith("recorded expense"))).toHaveLength(7);
    expect(logs.find((l) => l.action.startsWith("updated expense")).metadata.changes).toMatchObject({ amount: { to: 3100 }, title: { to: "October staff salaries" } });
    expect(logs.find((l) => l.action.startsWith("deleted expense")).metadata.reason).toBe("Wrong amount");
  });

  test("Super Admin gets expense totals; the accountant only their own rows and no totals", async () => {
    const sa = await call(tok.admin, "GET", `/expenses?month=${MONTH}`);
    expect(sa.body.data.totals).toMatchObject({ total: 4750.75, staff: 3100, other: 1650.75 });
    expect(sa.body.data.rows).toHaveLength(3);
    const acc = await call(tok.acc, "GET", `/expenses?month=${MONTH}`);
    expect(acc.status).toBe(200);
    expect(acc.body.data.scope).toBe("own");
    expect(acc.body.data.totals).toBeUndefined();
    expect(acc.body.data.rows.map((r) => r.description)).toEqual(["Chalk and markers"]);
    const other = sa.body.data.rows.find((r) => r.description === "Electricity bill");
    expect((await call(tok.acc, "GET", `/expenses/${other.id}`)).status).toBe(404);
  });

  // ---- report ----------------------------------------------------------------

  const expected = async (from, to) => {
    const [fee] = await q(`SELECT COALESCE(SUM(amount_paid),0) AS s, COUNT(*)::int AS n FROM fee_payments WHERE fk_school_id = :sid AND status = 'Paid' AND archived_at IS NULL AND payment_date >= :from AND payment_date < :to`, { sid: school.id, from, to });
    const [oi] = await q(`SELECT COALESCE(SUM(amount),0) AS s FROM other_incomes WHERE fk_school_id = :sid AND archived_at IS NULL AND income_date >= :from AND income_date < :to`, { sid: school.id, from, to });
    const [ex] = await q(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE fk_school_id = :sid AND archived_at IS NULL AND expense_date >= :from AND expense_date < :to`, { sid: school.id, from, to });
    return { fee: r2(fee.s), receipts: fee.n, other: r2(oi.s), expenses: r2(ex.s) };
  };

  test.each([["month", CUR.month], ["quarter", CUR.quarter], ["financial year", CUR.fy], ["previous FY", `FY${Number(CUR.fy.slice(2)) - 1}`]])(
    "report sums for the %s match the ledger tables",
    async (_label, key) => {
      const p = parsePeriod(key);
      const res = await call(tok.admin, "GET", `/finance/report?period=${p.key}`);
      expect(res.status).toBe(200);
      const { totals, series, breakdown, reconciliation } = res.body.data;
      const e = await expected(p.from, p.to);
      expect(totals.feeIncome).toBe(e.fee);
      expect(totals.otherIncome).toBe(e.other);
      expect(totals.income).toBe(r2(e.fee + e.other));
      expect(totals.expenses).toBe(e.expenses);
      expect(totals.net).toBe(r2(e.fee + e.other - e.expenses));
      expect(reconciliation.feeReceipts).toBe(e.receipts);
      const inPeriod = series.filter((s) => p.months.includes(s.month));
      expect(r2(inPeriod.reduce((s, m) => s + m.income, 0))).toBe(totals.income);
      expect(r2(inPeriod.reduce((s, m) => s + m.expenses, 0))).toBe(totals.expenses);
      expect(r2(breakdown.income.reduce((s, b) => s + b.amount, 0))).toBe(totals.income);
      expect(r2(breakdown.expenses.reduce((s, b) => s + b.amount, 0))).toBe(totals.expenses);
      if (totals.income > 0) expect(Math.abs(breakdown.income.reduce((s, b) => s + b.percent, 0) - 100)).toBeLessThan(0.5);
    },
  );

  test("this month's figures are exact (fee, other, expenses, net, percentages)", async () => {
    const res = await call(tok.admin, "GET", `/finance/report?period=${MONTH}`);
    const { totals, breakdown, series } = res.body.data;
    expect(totals).toMatchObject({ feeIncome: 2000.5, otherIncome: 5200, income: 7200.5, expenses: 4750.75, staffExpenses: 3100, net: 2449.75, position: "Surplus" });
    expect(series).toHaveLength(6);
    expect(breakdown.income.find((b) => b.key === "FeeIncome").percent).toBe(27.8);
    expect(breakdown.expenses.find((b) => b.key === "StaffSalary").percent).toBe(65.3);
  });

  test("the dashboard reconciles with the finance report for every period", async () => {
    for (const key of [MONTH, CUR.quarter, CUR.fy]) {
      const dash = (await call(tok.admin, "GET", `/dashboard?period=${key}`)).body.data.widgets;
      const rep = (await call(tok.admin, "GET", `/finance/report?period=${key}`)).body.data;
      expect(dash.finance.collected).toBe(rep.totals.feeIncome);
      expect(dash.incomeVsExpenses).toEqual({ income: rep.totals.income, expenses: rep.totals.expenses, net: rep.totals.net });
      expect(r2(dash.finance.byMethod.reduce((s, m) => s + m.amount, 0))).toBe(rep.totals.feeIncome);
    }
  });

  test("fee income reconciles with the monthly fee collection report", async () => {
    const fin = await call(tok.admin, "GET", `/finance/report?period=${MONTH}`);
    const rep = await call(tok.admin, "GET", `/fees/reports/monthly?month=${MONTH}&format=json`);
    expect(rep.status).toBe(200);
    const collected = Number(String(rep.body.data.summary.find(([l]) => l === "Total collected (PKR)")[1]).replace(/,/g, ""));
    const receipts = rep.body.data.summary.find(([l]) => l === "Receipts")[1];
    expect(fin.body.data.totals.feeIncome).toBe(collected);
    expect(fin.body.data.reconciliation.feeReceipts).toBe(receipts);
    // Previous month too (single receipt).
    const prev = dates.m1.slice(0, 7);
    const fin2 = await call(tok.admin, "GET", `/finance/report?period=${prev}`);
    const rep2 = await call(tok.admin, "GET", `/fees/reports/monthly?month=${prev}&format=json`);
    expect(fin2.body.data.totals.feeIncome).toBe(Number(String(rep2.body.data.summary.find(([l]) => l === "Total collected (PKR)")[1]).replace(/,/g, "")));
  });

  test("a Pending or archived payment is not income", async () => {
    const p = parsePeriod(dates.m13.slice(0, 7));
    const res = await call(tok.admin, "GET", `/finance/report?period=${p.key}`);
    expect(res.body.data.totals.feeIncome).toBe(0);
    const [{ id }] = await q("SELECT id FROM fee_payments WHERE fk_school_id = :sid AND payment_date = :d AND status = 'Paid'", { sid: school.id, d: dates.m1 });
    await sequelize.query("UPDATE fee_payments SET archived_at = NOW() WHERE id = :id", { replacements: { id } });
    const after = await call(tok.admin, "GET", `/finance/report?period=${dates.m1.slice(0, 7)}`);
    expect(after.body.data.totals.feeIncome).toBe(0);
    await sequelize.query("UPDATE fee_payments SET archived_at = NULL WHERE id = :id", { replacements: { id } });
  });

  test("period labels match the frontend picker exactly", () => {
    expect(parsePeriod("FY2026").label).toBe("FY 2026-27 (Apr 2026 \u2013 Mar 2027)");
    expect(parsePeriod("2026-Q2").label).toBe("Q2 2026-27 (Jul\u2013Sep 2026)");
    expect(parsePeriod("2026-Q4").label).toBe("Q4 2026-27 (Jan\u2013Mar 2027)");
    expect(parsePeriod("2026-09").label).toBe("September 2026");
  });

  test("expense categories with nothing in the period are left out of the breakdown", async () => {
    const { breakdown } = (await call(tok.admin, "GET", `/finance/report?period=${MONTH}`)).body.data;
    expect(breakdown.expenses.length).toBeGreaterThan(0);
    expect(breakdown.expenses.every((b) => b.amount > 0)).toBe(true);
    const csv = (await raw(tok.admin, `/finance/report/export?period=${MONTH}&format=csv`)).body.toString("utf8");
    const expenseLines = csv.split(/\r?\n/).filter((l) => l.startsWith("Expense,"));
    expect(expenseLines).toHaveLength(breakdown.expenses.length);
  });

  test("an invalid period is refused", async () => {
    for (const bad of ["2026-13", "2026-Q5", "FY26", "last-month"]) {
      expect((await call(tok.admin, "GET", `/finance/report?period=${bad}`)).status).toBe(400);
    }
  });

  // ---- permissions -------------------------------------------------------

  test("accountant: no income, no reports, no totals", async () => {
    expect((await call(tok.acc, "GET", "/finance/income")).status).toBe(403);
    expect((await call(tok.acc, "POST", "/finance/income", { category: "Donation", amount: 1, date: TODAY, description: "x y" })).status).toBe(403);
    expect((await call(tok.acc, "GET", "/finance/report")).status).toBe(403);
    expect((await raw(tok.acc, "/finance/report/export?format=csv")).status).toBe(403);
  });

  test("Ops, teacher and parent get 403 on every finance endpoint", async () => {
    const endpoints = [["GET", "/finance/income"], ["POST", "/finance/income"], ["PATCH", `/finance/income/${donationId}`], ["DELETE", `/finance/income/${donationId}`], ["GET", "/finance/report"], ["GET", "/expenses"], ["POST", "/expenses"], ["PATCH", "/expenses/1"], ["DELETE", "/expenses/1"]];
    for (const role of ["ops", "teacher", "parent"]) {
      for (const [method, path] of endpoints) {
        const res = await call(tok[role], method, path, method === "GET" ? undefined : { reason: "x y z" });
        expect([role, method, path, res.status]).toEqual([role, method, path, 403]);
      }
      expect((await raw(tok[role], "/finance/report/export?format=pdf")).status).toBe(403);
    }
  });

  test("Ops never sees expense or other-income audit entries", async () => {
    const res = await call(tok.ops, "GET", "/audit-logs?limit=200");
    if (res.status === 200) {
      const list = res.body.data.rows || res.body.data.logs || res.body.data;
      const types = (Array.isArray(list) ? list : []).map((l) => l.entityType);
      expect(types).not.toContain("expense");
      expect(types).not.toContain("other_income");
      expect(types).not.toContain("finance_report");
    } else {
      expect(res.status).toBe(403);
    }
  });

  // ---- exports -----------------------------------------------------------

  test("CSV, XLSX and PDF exports carry the report figures and are audited", async () => {
    const fin = (await call(tok.admin, "GET", `/finance/report?period=${CUR.quarter}`)).body.data;

    const csv = await raw(tok.admin, `/finance/report/export?period=${CUR.quarter}&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-disposition"]).toMatch(/financial-report-\d{4}-Q\d\.csv/);
    const text = csv.body.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text.split("\r\n");
    const value = (label) => Number(lines.find((l) => l.startsWith(`${label},`)).split(",")[1]);
    expect(value("Total income")).toBe(fin.totals.income);
    expect(value("Total expenses")).toBe(fin.totals.expenses);
    expect(lines.some((l) => l.startsWith("# Income entries"))).toBe(true);

    const xlsx = await raw(tok.admin, `/finance/report/export?period=${CUR.quarter}&format=xlsx`);
    expect(xlsx.status).toBe(200);
    const book = XLSX.read(xlsx.body, { type: "buffer" });
    expect(book.SheetNames).toEqual(["Summary", "Monthly", "Breakdown", "Income entries", "Expense entries"]);
    const summary = XLSX.utils.sheet_to_json(book.Sheets.Summary, { header: 1 });
    expect(summary.find((r) => r[0] === "Total income")[1]).toBe(fin.totals.income);
    expect(summary.find((r) => String(r[0]).startsWith("Net"))[1]).toBe(fin.totals.net);
    const incomeRows = XLSX.utils.sheet_to_json(book.Sheets["Income entries"], { header: 1 });
    const head = incomeRows.findIndex((r) => r[0] === "Date");
    const amounts = incomeRows.slice(head + 1).map((r) => r[4]).filter((v) => typeof v === "number");
    expect(r2(amounts.reduce((s, v) => s + v, 0))).toBe(fin.totals.income);

    const pdf = await raw(tok.admin, `/finance/report/export?period=${CUR.fy}&format=pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/pdf/);
    expect(pdf.body.slice(0, 5).toString()).toBe("%PDF-");
    expect(pdf.body.length).toBeGreaterThan(3000);

    const logs = await q("SELECT action FROM audit_logs WHERE fk_school_id = :sid AND entity_type = 'finance_report' AND action NOT LIKE :month", { sid: school.id, month: `%${MONTH} (%` });
    expect(logs).toHaveLength(3);
    expect((await raw(tok.admin, `/finance/report/export?period=${CUR.quarter}&format=doc`)).status).toBe(400);
  });
});
