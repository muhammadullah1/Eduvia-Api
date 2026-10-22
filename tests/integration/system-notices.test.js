"use strict";

const app = require("../../app");
const { sequelize, Attendances } = require("../../models");
const systemNotices = require("../../services/system_notice.service");
const { request } = require("../helpers/http");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");

const MONDAY = "2026-10-19";
const SUNDAY = "2026-10-18";

describe("system notices", () => {
  let fx;
  beforeAll(async () => {
    await sequelize.authenticate();
    const { school, session } = await makeSchool();
    const admin = await makeUser(school.id, "super_admin");
    const teacher = await makeUser(school.id, "teacher");
    const klass = await makeClass(school.id, session.id);
    await klass.update({ status: "Active" });
    const student = await makeStudent(school.id, klass.id);
    fx = { school, admin, teacher, klass, student };
  });

  const actor = (user) => ({ id: user.id, schoolId: user.fkSchoolId, role: user.role });

  test("no attendance notice until the school has used attendance", async () => {
    const notices = await systemNotices.list(actor(fx.admin), { today: MONDAY });
    expect(notices.find((n) => n.id === "attendance-not-marked")).toBeUndefined();
  });

  test("flags active classes without attendance on a school day, not on Sunday", async () => {
    await Attendances.create({ fkSchoolId: fx.school.id, fkStudentId: fx.student.id, fkClassId: fx.klass.id, date: "2026-10-17", status: "Present" });
    const notices = await systemNotices.list(actor(fx.admin), { today: MONDAY });
    expect(notices.find((n) => n.id === "attendance-not-marked")).toMatchObject({ count: 1, section: "student-attendance" });
    expect(await systemNotices.list(actor(fx.admin), { today: SUNDAY })).toEqual([]);
    await Attendances.create({ fkSchoolId: fx.school.id, fkStudentId: fx.student.id, fkClassId: fx.klass.id, date: MONDAY, status: "Present" });
    const after = await systemNotices.list(actor(fx.admin), { today: MONDAY });
    expect(after.find((n) => n.id === "attendance-not-marked")).toBeUndefined();
  });

  test("checks are pluggable and filtered by role", async () => {
    const checks = [{ roles: ["teacher"], run: async () => ({ id: "x", title: "X", detail: "", count: 1, section: "today" }) }];
    expect(await systemNotices.list(actor(fx.teacher), { checks })).toHaveLength(1);
    expect(await systemNotices.list(actor(fx.admin), { checks })).toHaveLength(0);
  });

  test("endpoint: 401 without a token, an array for signed-in users", async () => {
    expect((await request(app, { path: "/api/system-notices" })).status).toBe(401);
    const res = await request(app, { path: "/api/system-notices", token: tokenFor(fx.admin) });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const teacher = await request(app, { path: "/api/system-notices", token: tokenFor(fx.teacher) });
    expect(teacher.body.data).toEqual([]);
  });
});
