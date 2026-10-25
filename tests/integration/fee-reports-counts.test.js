"use strict";

/**
 * Finance Step 6: fee report counts and totals. Students are counted once (not per
 * bill row / fee type), months are calendar months, advance money comes from the
 * credit ledger, defaulters have overdue unpaid months, and every figure is
 * cross-checked against direct SQL. Also: role access, totals redaction for the
 * accountant (API and files) and real CSV / XLSX / PDF exports for each report.
 */
const XLSX = require("xlsx");
const app = require("../../app");
const { sequelize, StudentFeeMonths } = require("../../models");
const feeService = require("../../services/fee.service");
const { today } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const MONTH = "2026-09"; // every month Apr–Sep is past its due date
const KINDS = ["daily", "monthly", "class-wise", "student-wise", "outstanding", "advance", "defaulters"];
const call = (token, path) => request(app, { method: "GET", path: `/api${path}`, token });
const post = (token, path, body) => request(app, { method: "POST", path: `/api${path}`, token, body });
const raw = (token, path) => requestRaw(app, { path: `/api${path}`, token });
const q = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const summaryValue = (report, label) => {
  const hit = (report.summary || []).find(([l]) => l === label);
  return hit ? Number(String(hit[1]).replace(/[,%]/g, "")) : undefined;
};
const norm = (v) => String(v).replace(/,/g, "");
const byAdm = (rows, s) => rows.find((r) => r.admissionNo === s.admissionNo);

describe("fee report counts and totals (Step 6)", () => {
  let school; let session; let tok; let k1; let k2; let paid; let late; let multi; let credit;
  let admin; let acc;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    acc = await makeUser(school.id, "accountant");
    const users = { admin, acc, ops: await makeUser(school.id, "operations_manager"), teacher: await makeUser(school.id, "teacher") };
    k1 = await makeClass(school.id, session.id, "Cnt 1");
    k2 = await makeClass(school.id, session.id, "Cnt 2");
    await makeClass(school.id, session.id, "Cnt Empty");
    paid = await makeStudent(school.id, k1.id, { firstName: "Paid" });
    late = await makeStudent(school.id, k1.id, { firstName: "Late" });
    multi = await makeStudent(school.id, k1.id, { firstName: "Multi" });
    credit = await makeStudent(school.id, k2.id, { firstName: "Credit" });
    await makeStudent(school.id, k2.id, { firstName: "Gone", status: "Withdrawn" }); // not enrolled, never billed
    users.parent = await makeParent(school.id, paid.id);
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));

    const actor = (u, role) => ({ id: u.id, schoolId: school.id, role, email: u.email });
    const pay = (u, role, s, amount, paidOn, method = "Cash") => feeService.recordPayment(actor(u, role), { studentId: s.id, amount, paidOn, method });
    await pay(admin, "super_admin", paid, 6000, "2026-09-05"); // Apr–Sep exactly
    await pay(acc, "accountant", late, 2000, "2026-05-05", "BankTransfer"); // Apr–May only
    await pay(acc, "accountant", credit, 7500, "2026-09-05"); // Apr–Sep + 1,500 credit
    expect((await post(tok.admin, "/fees/months/generate", { month: MONTH })).status).toBe(201);
    // Fill any month the catch-up did not create, then add a second fee type for one month.
    for (const s of [late, multi]) {
      for (const m of ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
        await StudentFeeMonths.findOrCreate({
          where: { fkStudentId: s.id, month: m, feeType: "Tuition" },
          defaults: { fkSchoolId: school.id, baseAmount: 1000, discountAmount: 0, netAmount: 1000, paidAmount: 0, status: "Unpaid", dueDate: `${m}-10` },
        });
      }
    }
    await StudentFeeMonths.create({ fkSchoolId: school.id, fkStudentId: multi.id, month: "2026-06", feeType: "Exam", baseAmount: 500, discountAmount: 0, netAmount: 500, paidAmount: 0, status: "Unpaid", dueDate: "2026-06-10" });
  });

  afterAll(() => sequelize.close());

  const get = async (kind, extra = "") => {
    const res = await call(tok.admin, `/fees/reports/${kind}?month=${MONTH}${extra}`);
    expect(res.status).toBe(200);
    return res.body.data;
  };

  test("fixture sanity: Multi has 7 bill rows over 6 months", async () => {
    const [row] = await q("SELECT COUNT(*)::int AS bills, COUNT(DISTINCT month)::int AS months FROM student_fee_months WHERE fk_student_id = :id AND month <= :m", { id: multi.id, m: MONTH });
    expect(row).toEqual({ bills: 7, months: 6 });
  });

  test("class-wise counts students (not bills) and totals match SQL", async () => {
    const report = await get("class-wise");
    const c1 = report.rows.find((r) => r.className === "Cnt 1");
    const c2 = report.rows.find((r) => r.className === "Cnt 2");
    const ce = report.rows.find((r) => r.className === "Cnt Empty");
    expect(c1).toMatchObject({ enrolled: 3, billedStudents: 3, paidStudents: 1, partialStudents: 0, unpaidStudents: 2, billed: 3000, collected: 1000, collectionRate: 33.3 });
    expect(c1.outstanding).toBe(4000 + 6500); // Late Jun–Sep, Multi Apr–Sep + Exam
    expect(c2).toMatchObject({ enrolled: 1, billedStudents: 1, paidStudents: 1, billed: 1000, collected: 1000, outstanding: 0, collectionRate: 100 });
    expect(ce).toMatchObject({ enrolled: 0, billedStudents: 0, billed: 0, collectionRate: null });

    const [db] = await q(
      `SELECT COALESCE(SUM(net_amount) FILTER (WHERE month = :m),0) AS billed,
              COALESCE(SUM(paid_amount) FILTER (WHERE month = :m),0) AS collected,
              COALESCE(SUM(GREATEST(net_amount-paid_amount,0)) FILTER (WHERE month <= :m),0) AS outstanding,
              COUNT(DISTINCT fk_student_id) FILTER (WHERE month = :m)::int AS billed_students,
              COUNT(*) FILTER (WHERE month = :m)::int AS bill_rows
         FROM student_fee_months WHERE fk_school_id = :s AND archived_at IS NULL`,
      { s: school.id, m: MONTH },
    );
    expect(summaryValue(report, "Billed for the month (PKR)")).toBe(r2(db.billed));
    expect(summaryValue(report, "Collected against the month (PKR)")).toBe(r2(db.collected));
    expect(summaryValue(report, "Outstanding to date (PKR)")).toBe(r2(db.outstanding));
    expect(report.rows.reduce((s, r) => s + r.billedStudents, 0)).toBe(db.billed_students);
    const [enrolled] = await q("SELECT COUNT(*)::int AS n FROM students WHERE fk_school_id = :s AND archived_at IS NULL AND status IN ('Active','Pending')", { s: school.id });
    expect(summaryValue(report, "Enrolled students")).toBe(enrolled.n);
    expect(summaryValue(report, "Collection %")).toBe(Math.round((r2(db.collected) / r2(db.billed)) * 1000) / 10);
  });

  test("a second fee type in a month never inflates a student or month count", async () => {
    const june = await get("class-wise", "").then(() => call(tok.admin, `/fees/reports/class-wise?month=2026-06&classId=${k1.id}`));
    const row = june.body.data.rows[0];
    expect(row).toMatchObject({ enrolled: 3, billedStudents: 3, paidStudents: 1, unpaidStudents: 2, billed: 3500 });

    const sw = await get("student-wise", `&classId=${k1.id}`);
    expect(byAdm(sw.rows, multi)).toMatchObject({ monthsBilled: 6, monthsOpen: 6, due: 6500, paid: 0, outstanding: 6500, credit: 0 });
    expect(byAdm(sw.rows, late)).toMatchObject({ monthsBilled: 6, monthsOpen: 4, due: 6000, paid: 2000, outstanding: 4000, lastPayment: "2026-05-05" });
    const [db] = await q(
      `SELECT COUNT(DISTINCT (fk_student_id, month))::int AS sm, COALESCE(SUM(net_amount),0) AS due, COALESCE(SUM(paid_amount),0) AS paid
         FROM student_fee_months m JOIN students s ON s.id = m.fk_student_id
        WHERE m.fk_school_id = :s AND s.fk_class_id = :c AND m.month <= :m AND m.archived_at IS NULL`,
      { s: school.id, c: k1.id, m: MONTH },
    );
    expect(sw.rows.reduce((s, r) => s + r.monthsBilled, 0)).toBe(db.sm);
    expect(summaryValue(sw, "Due to date (PKR)")).toBe(r2(db.due));
    expect(summaryValue(sw, "Paid to date (PKR)")).toBe(r2(db.paid));

    const out = await get("outstanding");
    expect(out.rows.map((r) => r.admissionNo)).toEqual([multi.admissionNo, late.admissionNo]);
    expect(byAdm(out.rows, multi)).toMatchObject({ openMonths: 6, oldest: "Apr 2026", outstanding: 6500 });
    expect(summaryValue(out, "Open student-months")).toBe(10);
  });

  test("advance and credit come from the credit ledger", async () => {
    const adv = await get("advance");
    const [db] = await q(
      `SELECT COALESCE(SUM(CASE WHEN l.entry_type = 'Credit' THEN l.amount ELSE -l.amount END),0) AS c
         FROM student_credit_ledger l JOIN students s ON s.id = l.fk_student_id WHERE s.fk_school_id = :s`,
      { s: school.id },
    );
    expect(r2(db.c)).toBe(1500);
    expect(adv.rows).toHaveLength(1);
    expect(byAdm(adv.rows, credit)).toMatchObject({ credit: 1500, paidAhead: 0 });
    expect(summaryValue(adv, "Credit balance (PKR)")).toBe(1500);
    const sw = await get("student-wise", `&classId=${k2.id}`);
    expect(summaryValue(sw, "Credit balance (PKR)")).toBe(1500);
    expect(sw.rows.map((r) => r.admissionNo)).toEqual([credit.admissionNo]); // the withdrawn, never-billed student is not listed
  });

  test("defaulters: overdue months, last fully paid month, sorted by months unpaid", async () => {
    const d = await get("defaulters");
    expect(d.rows.map((r) => r.admissionNo)).toEqual([multi.admissionNo, late.admissionNo]);
    expect(byAdm(d.rows, multi)).toMatchObject({ lastPaid: "Never", monthsUnpaid: 6, outstanding: 6500 });
    expect(byAdm(d.rows, late)).toMatchObject({ lastPaid: "May 2026", lastPayment: "2026-05-05", monthsUnpaid: 4, months: "Jun 2026, Jul 2026, Aug 2026, Sep 2026", outstanding: 4000 });
    const [db] = await q(
      `SELECT COUNT(DISTINCT fk_student_id)::int AS students, COUNT(DISTINCT (fk_student_id, month))::int AS months,
              COALESCE(SUM(GREATEST(net_amount-paid_amount,0)),0) AS amount
         FROM student_fee_months WHERE fk_school_id = :s AND archived_at IS NULL AND month <= :m AND due_date < :t AND paid_amount < net_amount`,
      { s: school.id, m: MONTH, t: today() },
    );
    expect(summaryValue(d, "Defaulters")).toBe(db.students);
    expect(summaryValue(d, "Overdue student-months")).toBe(db.months);
    expect(summaryValue(d, "Overdue amount (PKR)")).toBe(r2(db.amount));
    // Before anything was due, nobody is a defaulter for a future month's bills only.
    const k2only = await get("defaulters", `&classId=${k2.id}`);
    expect(k2only.rows).toHaveLength(0);
  });

  test("Collect Fee overview counts students, not bills", async () => {
    const res = await call(tok.admin, "/fees/collect/overview");
    expect(res.status).toBe(200);
    const [db] = await q(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM student_fee_months m WHERE m.fk_student_id = s.id AND m.archived_at IS NULL
                                             AND m.month <= :m AND m.paid_amount < m.net_amount))::int AS open
         FROM students s WHERE s.fk_school_id = :s AND s.archived_at IS NULL AND s.status = 'Active'`,
      { s: school.id, m: today().slice(0, 7) },
    );
    expect(res.body.data).toMatchObject({ totalStudents: 4, withOutstanding: 2 });
    expect(res.body.data).toMatchObject({ totalStudents: db.total, withOutstanding: db.open });
  });

  test("daily and monthly collections match receipts in SQL", async () => {
    const daily = (await call(tok.admin, "/fees/reports/daily?from=2026-04-01&to=2026-09-30")).body.data;
    const [db] = await q(
      "SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_paid),0) AS t FROM fee_payments WHERE fk_school_id = :s AND status = 'Paid' AND payment_date BETWEEN '2026-04-01' AND '2026-09-30'",
      { s: school.id },
    );
    expect(summaryValue(daily, "Receipts")).toBe(db.n);
    expect(summaryValue(daily, "Total collected (PKR)")).toBe(r2(db.t));
    expect(summaryValue(daily, "Bank transfer (PKR)")).toBe(2000);
    const monthly = await get("monthly");
    expect(summaryValue(monthly, "Total collected (PKR)")).toBe(13500);
    expect(summaryValue(monthly, "Receipts")).toBe(2);
  });

  test("permissions: ops, teacher and parent get 403 on every report and format", async () => {
    for (const role of ["ops", "teacher", "parent"]) {
      for (const kind of KINDS) {
        for (const format of ["json", "csv", "xlsx", "pdf"]) {
          expect((await raw(tok[role], `/fees/reports/${kind}?format=${format}`)).status).toBe(403);
        }
      }
    }
  });

  test("accountant: only own daily receipts, no totals in API or any file", async () => {
    for (const kind of KINDS.filter((k) => k !== "daily")) {
      expect((await call(tok.acc, `/fees/reports/${kind}`)).status).toBe(403);
    }
    const res = await call(tok.acc, "/fees/reports/daily?from=2026-04-01&to=2026-09-30");
    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.summary).toBeNull();
    expect(report.rows.map((r) => r.admissionNo).sort()).toEqual([late.admissionNo, credit.admissionNo].sort());
    expect(JSON.stringify(report)).not.toMatch(/Total|total/);
    const csv = (await raw(tok.acc, "/fees/reports/daily?from=2026-04-01&to=2026-09-30&format=csv")).body.toString("utf8");
    expect(csv).not.toMatch(/Total|Receipts,/);
    expect(csv).not.toContain(paid.admissionNo);
    const book = XLSX.read((await raw(tok.acc, "/fees/reports/daily?from=2026-04-01&to=2026-09-30&format=xlsx")).body, { type: "buffer" });
    expect(book.SheetNames).toEqual(["Report"]);
    expect(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets.Report, { header: 1 }))).not.toMatch(/Total/);
    const pdf = (await raw(tok.acc, "/fees/reports/daily?from=2026-04-01&to=2026-09-30&format=pdf")).body.toString("latin1");
    expect(pdf).not.toMatch(/Total|\(Summary\)/);
  });

  test("every report exports CSV, XLSX and PDF with the same rows and totals", async () => {
    for (const kind of KINDS) {
      const qs = kind === "daily" ? "from=2026-04-01&to=2026-09-30" : `month=${MONTH}`;
      const json = (await call(tok.admin, `/fees/reports/${kind}?${qs}`)).body.data;
      const first = json.columns[0].label;

      const csvRes = await raw(tok.admin, `/fees/reports/${kind}?${qs}&format=csv`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers["content-disposition"]).toContain(`${json.filename}.csv`);
      const lines = XLSX.utils.sheet_to_json(XLSX.read(csvRes.body.toString("utf8").replace(/^\uFEFF/, ""), { type: "string", raw: true }).Sheets.Sheet1, { header: 1, blankrows: true, raw: false });
      expect(lines[0][0]).toBe("School");
      const h = lines.findIndex((l) => l[0] === first);
      expect(lines.slice(h + 1, h + 1 + json.rows.length)).toHaveLength(json.rows.length);
      for (const [label, value] of json.summary) expect(lines.some((l) => l[0] === label && norm(l[1]) === norm(value))).toBe(true);

      const xlsxRes = await raw(tok.admin, `/fees/reports/${kind}?${qs}&format=xlsx`);
      const book = XLSX.read(xlsxRes.body, { type: "buffer" });
      expect(book.SheetNames).toEqual(["Report", "Summary"]);
      const sheet = XLSX.utils.sheet_to_json(book.Sheets.Report, { header: 1 });
      const hx = sheet.findIndex((l) => l[0] === first);
      expect(sheet[hx]).toEqual(json.columns.map((c) => c.label));
      const body = sheet.slice(hx + 1).filter((l) => l.length);
      expect(body).toHaveLength(json.rows.length);
      json.columns.forEach((c, i) => {
        if (c.type === "money") expect(r2(body.reduce((s, l) => s + Number(l[i] || 0), 0))).toBe(r2(json.rows.reduce((s, r) => s + Number(r[c.key] || 0), 0)));
      });

      const pdfRes = await raw(tok.admin, `/fees/reports/${kind}?${qs}&format=pdf`);
      expect(pdfRes.headers["content-type"]).toBe("application/pdf");
      const pdf = pdfRes.body.toString("latin1");
      expect(pdf.startsWith("%PDF-")).toBe(true);
      expect(pdf).toContain(`(${json.title})`);
    }
  });
});
