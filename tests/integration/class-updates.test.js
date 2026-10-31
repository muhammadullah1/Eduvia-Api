"use strict";

const app = require("../../app");
const { AuditLogs, TeacherClasses, Teachers } = require("../../models");
const { makeClass, makeSchool, makeUser, tokenFor, uid } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

async function fixture() {
  const { school, session } = await makeSchool();
  const own = await makeClass(school.id, session.id);
  const other = await makeClass(school.id, session.id);
  const teacherUser = await makeUser(school.id, "teacher");
  const otherTeacherUser = await makeUser(school.id, "teacher");
  for (const user of [teacherUser, otherTeacherUser]) {
    const teacher = await Teachers.create({ fkSchoolId: school.id, fkUserId: user.id, employeeCode: `E${uid()}`.slice(0, 20) });
    await TeacherClasses.create({ fkTeacherId: teacher.id, fkClassId: own.id });
  }
  return {
    own,
    other,
    teacher: tokenFor(teacherUser),
    otherTeacher: tokenFor(otherTeacherUser),
    ops: tokenFor(await makeUser(school.id, "operations_manager")),
  };
}

const draft = (classId) => ({ classId, kind: "Notice", subject: "English", text: "Bring your reader" });

describe("class updates: teachers author, management approves", () => {
  test("a teacher drafts and edits only their own update for their own class", async () => {
    const fx = await fixture();
    expect((await call(fx.teacher, "POST", "/updates", draft(fx.other.id))).status).toBe(403);
    const created = await call(fx.teacher, "POST", "/updates", draft(fx.own.id));
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("Draft");
    const id = created.body.data.id;

    const edited = await call(fx.teacher, "PATCH", `/updates/${id}`, { text: "Bring your reader and notebook" });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ text: "Bring your reader and notebook", status: "Draft" });
    expect(await AuditLogs.count({ where: { entityType: "school_update", action: 'edited class notice "English"' } })).toBeGreaterThan(0);

    expect((await call(fx.otherTeacher, "PATCH", `/updates/${id}`, { text: "Hijack" })).status).toBe(403);
    expect((await call(fx.teacher, "PATCH", `/updates/${id}`, { classId: fx.other.id })).status).toBe(403);
  });

  test("a teacher cannot approve; after approval the author can no longer edit", async () => {
    const fx = await fixture();
    const id = (await call(fx.teacher, "POST", "/updates", draft(fx.own.id))).body.data.id;
    expect((await call(fx.teacher, "PATCH", `/updates/${id}/status`, { status: "Approved" })).status).toBe(403);
    expect((await call(fx.ops, "PATCH", `/updates/${id}/status`, { status: "Approved" })).status).toBe(200);
    expect((await call(fx.teacher, "PATCH", `/updates/${id}`, { text: "Late change" })).status).toBe(409);
  });

  test("editing a rejected update sends it back as a draft", async () => {
    const fx = await fixture();
    const id = (await call(fx.teacher, "POST", "/updates", draft(fx.own.id))).body.data.id;
    await call(fx.ops, "PATCH", `/updates/${id}/status`, { status: "Rejected" });
    const edited = await call(fx.teacher, "PATCH", `/updates/${id}`, { text: "Fixed wording" });
    expect(edited.body.data.status).toBe("Draft");
  });
});
