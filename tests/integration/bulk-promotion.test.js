"use strict";

const app = require("../../app");
const { sequelize, Classes, Students, StudentPromotions, StudentStatusEvents, AuditLogs, AcademicSessions } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");

const promote = (token, body) => request(app, { method: "POST", path: "/api/students/promotions/bulk", token, body });
const statusOf = async (klass) => (await Classes.findByPk(klass.id)).status;

describe("POST /students/promotions/bulk", () => {
  let school;
  let session;
  let token;
  let teacherToken;
  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    token = tokenFor(await makeUser(school.id, "super_admin"));
    teacherToken = tokenFor(await makeUser(school.id, "teacher"));
  });

  test("promotes, holds back and graduates in one transaction with audit and class status", async () => {
    const from = await makeClass(school.id, session.id, `Grade 5 ${Date.now()}`);
    const to = await makeClass(school.id, session.id, `Grade 6 ${Date.now()}`);
    await to.update({ status: "Inactive" });
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map(() => makeStudent(school.id, from.id)));

    const res = await promote(token, {
      fromClassId: from.id,
      toClassId: to.id,
      sessionId: session.id,
      date: "2026-10-20",
      graduationResult: "Passed",
      graduationOverride: true, // Grade 5 is not the final grade in this session
      students: [
        { studentId: a.id, action: "promote" },
        { studentId: b.id, action: "promote" },
        { studentId: c.id, action: "hold" },
        { studentId: d.id, action: "graduate" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ promoted: 2, repeated: 1, graduated: 1, toClass: { id: to.id } });

    expect((await Students.findByPk(a.id)).fkClassId).toBe(to.id);
    expect((await Students.findByPk(c.id)).fkClassId).toBe(from.id);
    expect((await Students.findByPk(d.id)).status).toBe("Graduated");
    const rows = await StudentPromotions.findAll({ where: { fkStudentId: [a.id, b.id, c.id] } });
    expect(rows.map((row) => row.outcome).sort()).toEqual(["Promoted", "Promoted", "Repeated"]);
    expect(await StudentStatusEvents.count({ where: { fkStudentId: d.id, toStatus: "Graduated", finalResult: "Passed" } })).toBe(1);
    expect(await statusOf(to)).toBe("Active");
    expect(await statusOf(from)).toBe("Active"); // the held-back student keeps it open
    const audit = await AuditLogs.findOne({ where: { fkSchoolId: school.id, entityType: "class", entityId: from.id } });
    expect(audit.action).toMatch(/2 promoted, 1 held back, 1 graduated/);

    const history = await request(app, { path: "/api/students/promotions/history?pageSize=50", token });
    expect(history.status).toBe(200);
    const types = history.body.data.events.filter((e) => [a.id, c.id, d.id].includes(e.student.id)).map((e) => e.type).sort();
    expect(types).toEqual(["Graduation", "Promotion", "Repeat"]);
  });

  test("everyone moving out empties the source class", async () => {
    const from = await makeClass(school.id, session.id);
    const to = await makeClass(school.id, session.id);
    const kids = await Promise.all([1, 2].map(() => makeStudent(school.id, from.id)));
    const res = await promote(token, {
      fromClassId: from.id, toClassId: to.id, sessionId: session.id, date: "2026-10-20",
      students: kids.map((kid) => ({ studentId: kid.id, action: "promote" })),
    });
    expect(res.status).toBe(200);
    expect(await statusOf(from)).toBe("Inactive");
  });

  test("hold-back into the next session uses the same grade and section", async () => {
    const next = await AcademicSessions.create({ fkSchoolId: school.id, name: `2027-28 ${Date.now()}`, startDate: "2027-04-01", endDate: "2028-03-31", isCurrent: false });
    const from = await makeClass(school.id, session.id, "Grade 3");
    const repeat = await makeClass(school.id, next.id, "Grade 3");
    const to = await makeClass(school.id, next.id, "Grade 4");
    const [up, stay] = await Promise.all([1, 2].map(() => makeStudent(school.id, from.id)));
    const res = await promote(token, {
      fromClassId: from.id, toClassId: to.id, sessionId: next.id, date: "2026-10-20",
      students: [{ studentId: up.id, action: "promote" }, { studentId: stay.id, action: "hold" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.repeatClass.id).toBe(repeat.id);
    expect((await Students.findByPk(stay.id)).fkClassId).toBe(repeat.id);
    expect(await statusOf(from)).toBe("Inactive");
  });

  test("rolls back everything when one student is not in the class", async () => {
    const from = await makeClass(school.id, session.id);
    const to = await makeClass(school.id, session.id);
    const other = await makeClass(school.id, session.id);
    const ok = await makeStudent(school.id, from.id);
    const stray = await makeStudent(school.id, other.id);
    const res = await promote(token, {
      fromClassId: from.id, toClassId: to.id, sessionId: session.id, date: "2026-10-20",
      students: [{ studentId: ok.id, action: "promote" }, { studentId: stray.id, action: "promote" }],
    });
    expect(res.status).toBe(409);
    expect((await Students.findByPk(ok.id)).fkClassId).toBe(from.id);
    expect(await StudentPromotions.count({ where: { fkStudentId: ok.id } })).toBe(0);
  });

  test("rejects over-capacity targets, missing graduation result, duplicates and bad input", async () => {
    const from = await makeClass(school.id, session.id);
    const tiny = await makeClass(school.id, session.id);
    await tiny.update({ capacity: 1 });
    const kids = await Promise.all([1, 2].map(() => makeStudent(school.id, from.id)));
    const base = { fromClassId: from.id, toClassId: tiny.id, sessionId: session.id, date: "2026-10-20" };

    const full = await promote(token, { ...base, students: kids.map((kid) => ({ studentId: kid.id, action: "promote" })) });
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/room for 1/);

    const grad = await promote(token, { ...base, students: [{ studentId: kids[0].id, action: "graduate" }] });
    expect(grad.status).toBe(400);

    const dup = await promote(token, { ...base, students: [{ studentId: kids[0].id, action: "promote" }, { studentId: kids[0].id, action: "hold" }] });
    expect(dup.status).toBe(400);

    const same = await promote(token, { ...base, toClassId: from.id, students: [{ studentId: kids[0].id, action: "promote" }] });
    expect(same.status).toBe(400);

    const bad = await promote(token, { ...base, students: [{ studentId: kids[0].id, action: "skip" }] });
    expect(bad.status).toBe(400);
    const empty = await promote(token, { ...base, students: [] });
    expect(empty.status).toBe(400);
    expect(await StudentPromotions.count({ where: { fkStudentId: kids.map((kid) => kid.id) } })).toBe(0);
  });

  test("needs students.manage", async () => {
    const res = await promote(teacherToken, { fromClassId: 1, sessionId: 1, date: "2026-10-20", students: [{ studentId: 1, action: "promote" }] });
    expect(res.status).toBe(403);
  });
});
