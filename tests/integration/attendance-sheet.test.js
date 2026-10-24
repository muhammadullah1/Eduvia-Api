"use strict";

/**
 * Printable attendance register (EDUVIA-14 P0): Super Admin / Operations Manager pick a
 * class and a day or month and get a PDF or XLSX with the active roster and blank
 * P/A/L/Leave boxes. Read-only: generating a sheet never writes attendance.
 */
const XLSX = require("xlsx");
const app = require("../../app");
const { sequelize, Attendances, Students, Subjects, Teachers } = require("../../models");
const { today } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, uid } = require("../helpers/school");
const { request, requestRaw } = require("../helpers/http");

const TODAY = today();
const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const raw = (token, path) => requestRaw(app, { path: `/api${path}`, token });

describe("attendance printable sheet", () => {
  let school; let session; let tok; let klass; let smTeacher;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    const users = {
      admin: await makeUser(school.id, "super_admin"),
      ops: await makeUser(school.id, "operations_manager"),
      acc: await makeUser(school.id, "accountant"),
      teacher: await makeUser(school.id, "teacher"),
    };
    await users.teacher.update({ firstName: "Sana", lastName: "Master" });
    const subject = await Subjects.create({ fkSchoolId: school.id, name: "Maths", code: `M${uid()}`.slice(0, 20) });
    smTeacher = await Teachers.create({ fkSchoolId: school.id, fkUserId: users.teacher.id, fkSubjectId: subject.id, employeeCode: `E${uid()}`.slice(0, 20) });
    tok = Object.fromEntries(Object.entries(users).map(([k, u]) => [k, tokenFor(u)]));
    klass = await makeClass(school.id, session.id, "Sheet 1");
    await makeStudent(school.id, klass.id, { firstName: "Zara", lastName: "Khan" });
    await makeStudent(school.id, klass.id, { firstName: "Ahmed", lastName: "Ali" });
    await makeStudent(school.id, klass.id, { firstName: "Gone", lastName: "Away", status: "Inactive" });
    expect((await call(tok.admin, "PUT", `/attendances/review/super-masters/${klass.id}`, { teacherId: smTeacher.id })).status).toBe(200);
  });

  test("only Super Admin / Operations Manager may print", async () => {
    expect((await raw(tok.acc, `/attendances/review/sheet?classId=${klass.id}`)).status).toBe(403);
    expect((await raw(tok.teacher, `/attendances/review/sheet?classId=${klass.id}`)).status).toBe(403);
    expect((await raw(null, `/attendances/review/sheet?classId=${klass.id}`)).status).toBe(401);
    expect((await raw(tok.ops, `/attendances/review/sheet?classId=${klass.id}&date=${TODAY}`)).status).toBe(200);
  });

  test("day PDF: header, Super Master, active roster in order, blank boxes; no attendance written", async () => {
    const before = await Attendances.count({ where: { fkClassId: klass.id } });
    const res = await raw(tok.admin, `/attendances/review/sheet?classId=${klass.id}&date=2026-10-23&format=pdf`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=.*attendance-sheet-.*2026-10-23\.pdf/);
    const text = res.body.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("Sana Master");
    expect(text).toContain("Friday, 23 October 2026");
    expect(text).toContain("Sheet 1");
    // Letterhead, same standard as the result documents.
    expect(text).toContain(`(${school.name})`);
    expect(text).toContain("/DCTDecode");
    expect(text).toContain("0.02 0.47 0.34 rg");
    expect(text).toContain("(Daily attendance sheet)");
    expect(text).toMatch(/\(Page 1 of 1\)/);
    expect(text).not.toContain("Gone Away");
    expect(text.indexOf("Ahmed Ali")).toBeGreaterThan(-1);
    expect(text.indexOf("Ahmed Ali")).toBeLessThan(text.indexOf("Zara Khan"));
    for (const label of ["(P)", "(A)", "(L)", "(Leave)"]) expect(text).toContain(label);
    expect(await Attendances.count({ where: { fkClassId: klass.id } })).toBe(before);
  });

  test("month XLSX: one column per day, Sundays labelled, totals columns", async () => {
    const res = await raw(tok.ops, `/attendances/review/sheet?classId=${klass.id}&month=2026-02&format=xlsx`);
    expect(res.status).toBe(200);
    const wb = XLSX.read(res.body, { type: "buffer" });
    expect(wb.SheetNames).toContain("Attendance");
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Attendance, { header: 1, defval: "" });
    const header = rows.find((r) => r[0] === "#");
    expect(header).toBeDefined();
    expect(header.length).toBe(3 + 28 + 4);
    expect(header).toContain("1 Sun");
    const names = rows.map((r) => r[2]);
    expect(names).toContain("Ahmed Ali");
    expect(names).not.toContain("Gone Away");
    expect(rows[0][0]).toBe(school.name);
    expect(JSON.stringify(rows)).toContain("Monthly attendance register");
  });

  test("a long roster spills onto more pages", async () => {
    const extra = [];
    for (let i = 0; i < 45; i += 1) extra.push((await makeStudent(school.id, klass.id, { firstName: `Extra${String(i).padStart(2, "0")}` })).id);
    try {
      const res = await raw(tok.admin, `/attendances/review/sheet?classId=${klass.id}&date=${TODAY}`);
      const count = Number(/\/Count (\d+)/.exec(res.body.toString("latin1"))[1]);
      expect(count).toBeGreaterThan(1);
    } finally {
      await Students.destroy({ where: { id: extra }, force: true });
    }
  });

  test("validation", async () => {
    expect((await raw(tok.admin, "/attendances/review/sheet")).status).toBe(400);
    expect((await raw(tok.admin, `/attendances/review/sheet?classId=${klass.id}&date=${TODAY}&month=2026-10`)).status).toBe(400);
    expect((await raw(tok.admin, `/attendances/review/sheet?classId=${klass.id}&format=docx`)).status).toBe(400);
    expect((await raw(tok.admin, `/attendances/review/sheet?classId=${klass.id}&date=2026-13-40`)).status).toBe(400);
    expect((await raw(tok.admin, "/attendances/review/sheet?classId=99999999")).status).toBe(404);
  });
});
