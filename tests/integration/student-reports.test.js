"use strict";

const XLSX = require("xlsx");
const app = require("../../app");
const { sequelize, StudentStatusEvents } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const call = (token, path) => request(app, { path: `/api${path}`, token });
const raw = (token, path) => requestRaw(app, { path: `/api${path}`, token });

describe("student and management reports", () => {
  let school; let tok; let k1; let k2;

  beforeAll(async () => {
    await sequelize.authenticate();
    let session;
    ({ school, session } = await makeSchool());
    tok = Object.fromEntries(await Promise.all(
      ["super_admin", "operations_manager", "accountant", "teacher", "parent"].map(async (role) => [role, tokenFor(await makeUser(school.id, role))]),
    ));
    k1 = await makeClass(school.id, session.id, "One");
    k2 = await makeClass(school.id, session.id, "Two");
    await makeStudent(school.id, k1.id, { firstName: "Ali", gender: "Male", admissionDate: "2026-04-10" });
    await makeStudent(school.id, k1.id, { firstName: "Sara", gender: "Female", admissionDate: "2026-04-20" });
    const gone = await makeStudent(school.id, k2.id, { firstName: "Omar", gender: "Male", admissionDate: "2026-06-02", status: "Withdrawn" });
    await StudentStatusEvents.create({
      fkSchoolId: school.id, fkStudentId: gone.id, fromStatus: "Active", toStatus: "Withdrawn",
      eventType: "Withdrawn", reason: "Family moved", effectiveOn: "2026-09-01", fkClassId: k2.id,
    });
  });

  afterAll(() => sequelize.close());

  test("student list filters by class and status and counts by gender", async () => {
    const all = await call(tok.super_admin, "/reports/students/students");
    expect(all.status).toBe(200);
    expect(all.body.data.rows).toHaveLength(3);
    const one = (await call(tok.super_admin, `/reports/students/students?classId=${k1.id}&status=Active`)).body.data;
    expect(one.rows.map((r) => r.student).sort()).toEqual(["Ali Test", "Sara Test"]);
    expect(one.summary).toEqual([["Students", 2], ["Boys", 1], ["Girls", 1]]);
  });

  test("admission trend fills empty months inside the range", async () => {
    const res = (await call(tok.operations_manager, "/reports/students/admissions?from=2026-04-01&to=2026-06-30")).body.data;
    expect(res.rows).toEqual([
      { month: "Apr 2026", admissions: 2, boys: 1, girls: 1 },
      { month: "May 2026", admissions: 0, boys: 0, girls: 0 },
      { month: "Jun 2026", admissions: 1, boys: 1, girls: 0 },
    ]);
    expect((await call(tok.super_admin, "/reports/students/admissions?from=2026-06-30&to=2026-04-01")).status).toBe(400);
  });

  test("class distribution counts active students against capacity", async () => {
    const res = (await call(tok.super_admin, "/reports/students/class-distribution")).body.data;
    const one = res.rows.find((r) => r.className === "One");
    expect(one).toMatchObject({ active: 2, boys: 1, girls: 1, other: 0, capacity: 30, fill: 7 });
    expect(res.rows.find((r) => r.className === "Two")).toMatchObject({ active: 0, other: 1 });
  });

  test("status records list lifecycle events in the period", async () => {
    const res = (await call(tok.super_admin, "/reports/students/status-changes?from=2026-08-01&to=2026-09-30")).body.data;
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ event: "Withdrawn", change: "Active → Withdrawn", reason: "Family moved" });
    expect((await call(tok.super_admin, "/reports/students/promotions?from=2026-01-01&to=2026-12-31")).body.data.rows).toEqual([]);
  });

  test("CSV, XLSX and PDF carry the same rows as the screen", async () => {
    const json = (await call(tok.super_admin, "/reports/students/students")).body.data;
    const csv = await raw(tok.super_admin, "/reports/students/students?format=csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-disposition"]).toContain(`${json.filename}.csv`);
    json.rows.forEach((r) => expect(csv.body.toString("utf8")).toContain(r.admissionNo));
    const book = XLSX.read((await raw(tok.super_admin, "/reports/students/students?format=xlsx")).body, { type: "buffer" });
    const text = XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]]);
    json.rows.forEach((r) => expect(text).toContain(r.admissionNo));
    const pdf = await raw(tok.super_admin, "/reports/students/students?format=pdf");
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("only Super Admin and Operations can open student reports", async () => {
    for (const role of ["accountant", "teacher", "parent"]) {
      expect((await call(tok[role], "/reports/students/students")).status).toBe(403);
      expect((await raw(tok[role], "/reports/students/students?format=csv")).status).toBe(403);
    }
    expect((await call(tok.super_admin, "/reports/students/nope")).status).toBe(400);
  });

  test("another school's class is refused", async () => {
    const other = await makeSchool();
    const foreign = await makeClass(other.school.id, other.session.id, "Elsewhere");
    expect((await call(tok.super_admin, `/reports/students/students?classId=${foreign.id}`)).status).toBe(404);
  });
});
