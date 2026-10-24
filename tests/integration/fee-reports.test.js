"use strict";

/**
 * Fee reports (SRS 4.5) and the offline-import template. Super Admin sees every
 * report with totals; the accountant only their own daily receipts and never a
 * total; Operations Manager, teacher and parent are refused (fee data is
 * Super Admin + Accountant only). Figures are cross-checked against the ledger.
 */
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const app = require("../../app");
const { sequelize, Teachers, Subjects } = require("../../models");
const { today } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent, uid } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const TODAY = today();
const MONTH = TODAY.slice(0, 7);
const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const raw = (token, path) => requestRaw(app, { path: `/api${path}`, token });
const q = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const money = (v) => Math.round(Number(v || 0) * 100) / 100;
const summaryValue = (report, label) => {
  const hit = report.summary.find(([l]) => l === label);
  return hit ? Number(String(hit[1]).replace(/,/g, "")) : undefined;
};

describe("fee reports", () => {
  let school; let session; let tok; let classA; let classB; let s1; let s2; let s3; let users;

  beforeAll(async () => {
    await sequelize.authenticate();
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
    classA = await makeClass(school.id, session.id, "Rpt A");
    classB = await makeClass(school.id, session.id, "Rpt B");
    s1 = await makeStudent(school.id, classA.id, { firstName: "Ayan" });
    s2 = await makeStudent(school.id, classA.id, { firstName: "Bisma" });
    s3 = await makeStudent(school.id, classB.id, { firstName: "Cyrus" });
    users.parent = await makeParent(school.id, s1.id);
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    tok.teacher = tok.teacherUser;

    expect((await call(tok.admin, "POST", "/fees/months/generate", { month: MONTH })).status).toBe(201);
    const pay = async (token, studentId, amount, method) => {
      const res = await call(token, "POST", "/fees/payments", { studentId, amount, paidOn: TODAY, method });
      if (res.status !== 201) console.log(JSON.stringify(res.body)); expect(res.status).toBe(201);
    };
    await pay(tok.acc, s1.id, 1000, "Cash");
    await pay(tok.admin, s2.id, 500, "BankTransfer");
    // Far more than s3 owes: clears every month, then pre-pays later months (Advance).
    const owed = await q("SELECT COALESCE(SUM(net_amount - paid_amount),0) AS due FROM student_fee_months WHERE fk_student_id = :id", { id: s3.id });
    await pay(tok.acc2, s3.id, money(owed[0].due) + 1500, "Cash");
  });

  test("operations manager, teacher and parent are refused every fee report and the template", async () => {
    for (const role of ["ops", "teacher", "parent"]) {
      for (const kind of ["daily", "monthly", "class-wise", "student-wise", "outstanding", "advance"]) {
        expect((await call(tok[role], "GET", `/fees/reports/${kind}`)).status).toBe(403);
      }
      expect((await raw(tok[role], "/fees/import-template")).status).toBe(403);
    }
    expect((await call(null, "GET", "/fees/reports/daily")).status).toBe(401);
  });

  test("operations manager can no longer read fee months or expenses", async () => {
    expect((await call(tok.ops, "GET", "/fees/months")).status).toBe(403);
    expect((await call(tok.ops, "GET", "/fees/payments")).status).toBe(403);
    expect((await call(tok.ops, "GET", "/expenses")).status).toBe(403);
    expect((await call(tok.acc, "GET", "/fees/months")).status).toBe(200);
  });

  test("accountant gets only their own daily receipts, without any total", async () => {
    const res = await call(tok.acc, "GET", `/fees/reports/daily?from=${TODAY}&to=${TODAY}`);
    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.summary).toBeNull();
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ admissionNo: s1.admissionNo, amount: 1000, method: "Cash" });
    expect(report.columns.map((c) => c.key)).not.toContain("recordedBy");
    for (const kind of ["monthly", "class-wise", "student-wise", "outstanding", "advance"]) {
      expect((await call(tok.acc, "GET", `/fees/reports/${kind}`)).status).toBe(403);
    }
    // Same rule in the files: no summary sheet / totals.
    const xlsx = await raw(tok.acc, `/fees/reports/daily?from=${TODAY}&format=xlsx`);
    const book = XLSX.read(xlsx.body, { type: "buffer" });
    expect(book.SheetNames).toEqual(["Report"]);
    const pdf = await raw(tok.acc, `/fees/reports/daily?from=${TODAY}&format=pdf`);
    expect(pdf.body.toString("latin1")).not.toContain("Total collected");
  });

  test("super admin daily report lists every receipt with totals matching the database", async () => {
    const res = await call(tok.admin, "GET", `/fees/reports/daily?from=${TODAY}&to=${TODAY}`);
    const report = res.body.data;
    const [db] = await q(
      "SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_paid),0) AS total FROM fee_payments WHERE fk_school_id = :s AND status = 'Paid' AND payment_date = :d",
      { s: school.id, d: TODAY },
    );
    expect(report.rows).toHaveLength(db.n);
    expect(summaryValue(report, "Total collected (PKR)")).toBe(money(db.total));
    expect(summaryValue(report, "Bank transfer (PKR)")).toBe(500);
    const byClass = await call(tok.admin, "GET", `/fees/reports/daily?from=${TODAY}&classId=${classA.id}`);
    expect(byClass.body.data.rows.map((r) => r.admissionNo).sort()).toEqual([s1.admissionNo, s2.admissionNo].sort());
  });

  test("monthly, class-wise, student-wise, outstanding and advance agree with the ledger", async () => {
    const monthly = (await call(tok.admin, "GET", `/fees/reports/monthly?month=${MONTH}`)).body.data;
    const [paid] = await q(
      "SELECT COALESCE(SUM(amount_paid),0) AS total FROM fee_payments WHERE fk_school_id = :s AND status = 'Paid' AND to_char(payment_date,'YYYY-MM') = :m",
      { s: school.id, m: MONTH },
    );
    expect(summaryValue(monthly, "Total collected (PKR)")).toBe(money(paid.total));

    const classWise = (await call(tok.admin, "GET", `/fees/reports/class-wise?month=${MONTH}`)).body.data;
    const [ledger] = await q(
      `SELECT COALESCE(SUM(GREATEST(net_amount - paid_amount,0)) FILTER (WHERE month <= :m),0) AS outstanding,
              COALESCE(SUM(net_amount) FILTER (WHERE month = :m),0) AS billed,
              COALESCE(SUM(paid_amount) FILTER (WHERE month > :m),0) AS prepaid
         FROM student_fee_months WHERE fk_school_id = :s`,
      { s: school.id, m: MONTH },
    );
    expect(summaryValue(classWise, "Outstanding to date (PKR)")).toBe(money(ledger.outstanding));
    expect(summaryValue(classWise, "Billed for the month (PKR)")).toBe(money(ledger.billed));
    const rowA = classWise.rows.find((r) => r.className === "Rpt A");
    expect(rowA.students).toBe(2);

    const outstanding = (await call(tok.admin, "GET", `/fees/reports/outstanding?month=${MONTH}`)).body.data;
    expect(summaryValue(outstanding, "Total outstanding (PKR)")).toBe(money(ledger.outstanding));
    expect(outstanding.rows.map((r) => r.admissionNo)).not.toContain(s3.admissionNo); // fully paid

    const advance = (await call(tok.admin, "GET", `/fees/reports/advance?month=${MONTH}`)).body.data;
    const [credit] = await q("SELECT COALESCE(SUM(unallocated_amount),0) AS c FROM fee_payments WHERE fk_school_id = :s AND status = 'Paid'", { s: school.id });
    expect(advance.rows.map((r) => r.admissionNo)).toEqual([s3.admissionNo]);
    expect(summaryValue(advance, "Total advance (PKR)")).toBe(money(money(ledger.prepaid) + money(credit.c)));
    expect(summaryValue(advance, "Total advance (PKR)")).toBe(1500);

    const studentWise = (await call(tok.admin, "GET", `/fees/reports/student-wise?month=${MONTH}&classId=${classB.id}`)).body.data;
    expect(studentWise.rows).toHaveLength(1);
    expect(studentWise.rows[0]).toMatchObject({ admissionNo: s3.admissionNo, outstanding: 0, advance: 1500 });
  });

  test("downloads are real CSV, XLSX and PDF files with the same rows", async () => {
    const csv = await raw(tok.admin, `/fees/reports/daily?from=${TODAY}&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toMatch(/attachment; filename="daily-collections-.*\.csv"/);
    const text = csv.body.toString("utf8");
    for (const s of [s1, s2, s3]) expect(text).toContain(s.admissionNo);
    expect(text).toContain("Total collected (PKR)");

    const xlsx = await raw(tok.admin, `/fees/reports/outstanding?month=${MONTH}&format=xlsx`);
    const book = XLSX.read(xlsx.body, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(book.Sheets.Report, { header: 1 });
    const headerIndex = rows.findIndex((r) => r[0] === "Admission no");
    expect(headerIndex).toBeGreaterThan(0);
    expect(rows.slice(headerIndex + 1).map((r) => r[0]).sort()).toEqual([s1.admissionNo, s2.admissionNo].sort());

    const pdf = await raw(tok.admin, `/fees/reports/class-wise?month=${MONTH}&format=pdf`);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    const body = pdf.body.toString("latin1");
    expect(body.startsWith("%PDF-1.4")).toBe(true);
    expect(body.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(body).toContain("(Rpt A)");
  });

  test("every format carries the school letterhead (crest, colours, name, filters, generated by/at)", async () => {
    const BRAND_FILL = "0.02 0.47 0.34 rg"; // #047857, the result-document green

    const pdf = (await raw(tok.admin, `/fees/reports/daily?from=${TODAY}&format=pdf`)).body.toString("latin1");
    expect(pdf).toContain(`(${school.name})`);
    expect(pdf).toContain("/Subtype /Image");
    expect(pdf).toContain("/DCTDecode");
    expect(pdf).toContain("/Im1 Do");
    expect(pdf).toContain(BRAND_FILL);
    expect(pdf).toContain("(Daily fee collections)");
    expect(pdf).toContain("(DATE)");
    expect(pdf).toMatch(/\(Page 1 of 1\)/);
    expect(pdf).toMatch(/Generated by .* on .* PKT/);

    const csv = (await raw(tok.admin, `/fees/reports/daily?from=${TODAY}&format=csv`)).body.toString("utf8").replace(/^\uFEFF/, "");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(`School,${school.name}`);
    expect(lines[1]).toBe("Report,Daily fee collections");
    expect(lines).toContain(`Date,${TODAY}`);
    const blank = lines.indexOf("");
    expect(lines.slice(0, blank).every((line) => line.split(",").length >= 2)).toBe(true);
    expect(lines.slice(0, blank).some((line) => line.startsWith("Generated at,"))).toBe(true);
    expect(lines[blank + 1].startsWith("Date,Receipt no,")).toBe(true);

    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await raw(tok.admin, `/fees/reports/daily?from=${TODAY}&format=xlsx`)).body);
    const sheet = book.getWorksheet("Report");
    expect(sheet.getImages()).toHaveLength(1);
    expect(sheet.getCell("A1").value).toBe(school.name);
    expect(sheet.getCell("A4").value).toBe("Daily fee collections");
    let head;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "Date" && !head) head = row;
    });
    expect(head.getCell(1).fill.fgColor.argb).toBe("FF047857");
  });

  test("validation: unknown kind, bad dates, reversed range and foreign class", async () => {
    expect((await call(tok.admin, "GET", "/fees/reports/everything")).status).toBe(400);
    expect((await call(tok.admin, "GET", "/fees/reports/daily?from=2026-1-1")).status).toBe(400);
    expect((await call(tok.admin, "GET", "/fees/reports/monthly?month=2026-13x")).status).toBe(400);
    expect((await call(tok.admin, "GET", "/fees/reports/daily?from=2026-10-10&to=2026-10-01")).status).toBe(400);
    expect((await call(tok.admin, "GET", "/fees/reports/daily?format=docx")).status).toBe(400);
    const other = await makeSchool();
    const foreign = await makeClass(other.school.id, other.session.id, "Foreign");
    expect((await call(tok.admin, "GET", `/fees/reports/class-wise?classId=${foreign.id}`)).status).toBe(404);
  });

  test("import template is branded, keeps the importer's exact columns and a filled copy imports", async () => {
    const res = await raw(tok.acc, "/fees/import-template");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("fee-import-template.xlsx");
    const book = XLSX.read(res.body, { type: "buffer" });
    expect(book.SheetNames).toEqual(["Payments", "Instructions"]);
    const rows = XLSX.utils.sheet_to_json(book.Sheets.Payments, { header: 1, blankrows: true });
    expect(rows[0][0]).toBe(school.name);
    const headerIndex = rows.findIndex((r) => r[0] === "Admission Number");
    expect(headerIndex).toBeGreaterThan(0);
    expect(rows[headerIndex]).toEqual(["Admission Number", "Month", "Amount", "Payment Date", "Receipt/Reference", "Payment Method", "Notes"]);
    expect(rows.slice(headerIndex + 1).filter((r) => r.length)).toHaveLength(0);
    expect(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets.Instructions, { header: 1 }))).toContain("EXAMPLE ONLY");
    const styled = new ExcelJS.Workbook();
    await styled.xlsx.load(res.body);
    expect(styled.getWorksheet("Payments").getImages()).toHaveLength(1);

    // An empty template imports nothing.
    const empty = await call(tok.acc, "POST", "/fees/payments/import", { filename: "empty.xlsx", contentBase64: res.body.toString("base64") });
    expect(empty.body.data).toMatchObject({ success: 0, failed: 0, skipped: 0 });

    // Fill the template exactly as a user would (first row under the header) and upload it.
    const ref = `T-${uid()}`;
    XLSX.utils.sheet_add_aoa(book.Sheets.Payments, [[s2.admissionNo, MONTH, 250, TODAY, ref, "Bank Transfer", "template test"]], { origin: `A${headerIndex + 2}` });
    const contentBase64 = XLSX.write(book, { type: "base64", bookType: "xlsx" });
    const imported = await call(tok.acc, "POST", "/fees/payments/import", { filename: "filled.xlsx", contentBase64 });
    expect(imported.status).toBe(200);
    expect(imported.body.data).toMatchObject({ success: 1, failed: 0, skipped: 0 });
    expect(imported.body.data.rows[0].line).toBe(headerIndex + 2);
    const again = await call(tok.acc, "POST", "/fees/payments/import", { filename: "filled.xlsx", contentBase64 });
    expect(again.body.data).toMatchObject({ success: 0, skipped: 1 });
  });

  test("a plain workbook with the header in row 1 still imports (unchanged behaviour)", async () => {
    const plain = XLSX.utils.book_new();
    const ref = `P-${uid()}`;
    XLSX.utils.book_append_sheet(
      plain,
      XLSX.utils.aoa_to_sheet([
        ["Admission Number", "Month", "Amount", "Payment Date", "Receipt/Reference", "Payment Method", "Notes"],
        [s2.admissionNo, MONTH, 100, TODAY, ref, "Cash", "plain sheet"],
        ["NOPE-404", MONTH, 100, TODAY, `${ref}-x`, "Cash", ""],
      ]),
      "Sheet1",
    );
    const contentBase64 = XLSX.write(plain, { type: "base64", bookType: "xlsx" });
    const result = (await call(tok.acc, "POST", "/fees/payments/import", { filename: "plain.xlsx", contentBase64 })).body.data;
    expect(result).toMatchObject({ success: 1, failed: 1 });
    expect(result.rows.map((r) => r.line)).toEqual([2, 3]);
  });
});
