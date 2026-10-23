"use strict";

/**
 * Attendance review (SRS 6.3): management-only reports, Late status, the edit
 * window, required reasons, the permanent change history, reminders, and the
 * teacher re-mark window.
 */
const app = require("../../app");
const {
  sequelize, Attendances, AttendanceChanges, AttendanceReminders, AuditLogs, SchoolSettings,
  Subjects, Teachers, TimetableSlots, Users, Classes,
} = require("../../models");
const { today: schoolToday, parse, iso, weekdayOf } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent, uid } = require("../helpers/school");
const { request } = require("../helpers/http");

const shift = (date, days) => { const d = parse(date); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
const TODAY = schoolToday();
const MONTH = TODAY.slice(0, 7);
const get = (token, path) => request(app, { method: "GET", path: `/api/attendances${path}`, token });
const send = (token, method, path, body) => request(app, { method, path: `/api/attendances${path}`, token, body });

describe("attendance review", () => {
  let school; let session; let admin; let ops; let parent; let teacherUser; let klass; let other;
  let tokens; let kids;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    ops = await makeUser(school.id, "operations_manager");
    const subject = await Subjects.create({ fkSchoolId: school.id, name: "Maths", code: `M${uid()}`.slice(0, 20) });
    teacherUser = await makeUser(school.id, "teacher");
    const teacher = await Teachers.create({ fkSchoolId: school.id, fkUserId: teacherUser.id, fkSubjectId: subject.id, employeeCode: `E${uid()}`.slice(0, 20) });
    klass = await makeClass(school.id, session.id, "Review 7");
    other = await makeClass(school.id, session.id, "Review 8");
    // The teacher is this class's explicitly assigned Super Master.
    await klass.update({ fkSuperMasterTeacherId: teacher.id });
    await TimetableSlots.create({ fkSchoolId: school.id, fkClassId: klass.id, fkTeacherId: teacher.id, fkSubjectId: subject.id, day: weekdayOf(TODAY), periodIndex: 1 });
    kids = [];
    for (const name of ["Ali", "Bina", "Cyra", "Dawood"]) kids.push(await makeStudent(school.id, klass.id, { firstName: name }));
    parent = await makeParent(school.id, kids[1].id);
    tokens = { admin: tokenFor(admin), ops: tokenFor(ops), teacher: tokenFor(teacherUser) };
    const parentUser = await Users.findOne({ where: { fkSchoolId: school.id, role: "parent" } });
    tokens.parent = parentUser ? tokenFor(parentUser) : null;

    // Teacher marks today with Late, and two earlier days.
    const mark = (date, statuses) => send(tokens.teacher, "POST", "/mark", {
      classId: klass.id, date, marks: kids.map((k, i) => ({ studentId: k.id, status: statuses[i] })),
    });
    expect((await mark(TODAY, ["Present", "Absent", "Late", "Leave"])).status).toBe(200);
    await mark(shift(TODAY, -1), ["Present", "Absent", "Present", "Present"]);
    await mark(shift(TODAY, -2), ["Present", "Absent", "Absent", "Present"]);
  });

  test("review endpoints are management-only", async () => {
    for (const role of ["teacher", "parent"]) {
      if (!tokens[role]) continue;
      expect((await get(tokens[role], "/review/today")).status).toBe(403);
      expect((await send(tokens[role], "PATCH", "/1", { status: "Present", reason: "Nope" })).status).toBe(403);
    }
    expect((await get(tokens.ops, "/review/today")).status).toBe(200);
    expect(parent).toBeTruthy();
  });

  test("today's status lists taken and pending classes with teacher and counts", async () => {
    const { body } = await get(tokens.admin, `/review/today?date=${TODAY}`);
    const rows = Object.fromEntries(body.data.classes.map((c) => [c.classId, c]));
    expect(rows[klass.id]).toMatchObject({ taken: true, present: 2, absent: 1, late: 1, leave: 1, students: 4 });
    expect(rows[klass.id].teacher).toBe(`${teacherUser.firstName} ${teacherUser.lastName}`);
    expect(rows[other.id]).toMatchObject({ taken: false, present: null });
    expect(body.data.taken + body.data.pending).toBe(body.data.total);
  });

  test("daily report shows per-student status and the edit window", async () => {
    const { body } = await get(tokens.admin, `/review/daily?classId=${klass.id}&date=${TODAY}`);
    expect(body.data.summary).toMatchObject({ total: 4, present: 1, absent: 1, late: 1, leave: 1, unmarked: 0 });
    expect(body.data.canEdit).toBe(true);
    expect(body.data.students.find((s) => s.studentId === kids[2].id).status).toBe("Late");
  });

  test("editing needs a reason, a different status, and the edit window; it is logged permanently", async () => {
    const row = await Attendances.findOne({ where: { fkStudentId: kids[1].id, date: TODAY } });
    expect((await send(tokens.ops, "PATCH", `/${row.id}`, { status: "Late" })).status).toBe(400);
    expect((await send(tokens.ops, "PATCH", `/${row.id}`, { status: "Absent", reason: "Same status" })).status).toBe(409);
    const ok = await send(tokens.ops, "PATCH", `/${row.id}`, { status: "Late", reason: "Arrived after the register" });
    expect(ok.status).toBe(200);
    expect((await row.reload()).status).toBe("Late");
    const change = await AttendanceChanges.findOne({ where: { fkAttendanceId: row.id, source: "review" } });
    expect(change).toMatchObject({ fromStatus: "Absent", toStatus: "Late", reason: "Arrived after the register", fkActorUserId: ops.id });
    expect(await AuditLogs.count({ where: { entityType: "attendance", entityId: row.id } })).toBeGreaterThan(0);

    // Outside the window: tighten to same-day and edit yesterday.
    await SchoolSettings.create({ fkSchoolId: school.id, key: "attendance", value: { editWindowDays: 0 } });
    const old = await Attendances.findOne({ where: { fkStudentId: kids[0].id, date: shift(TODAY, -1) } });
    // Ops (and any non-Super-Admin) is held to the window: 409.
    const late = await send(tokens.ops, "PATCH", `/${old.id}`, { status: "Absent", reason: "Too late now" });
    expect(late.status).toBe(409);
    // Super Admin may edit outside the window, but still needs a reason and is logged.
    expect((await send(tokens.admin, "PATCH", `/${old.id}`, { status: "Absent" })).status).toBe(400);
    expect((await send(tokens.admin, "PATCH", `/${old.id}`, { status: "Absent", reason: "   " })).status).toBe(400);
    const sa = await send(tokens.admin, "PATCH", `/${old.id}`, { status: "Absent", reason: "Corrected by principal" });
    expect(sa.status).toBe(200);
    expect(await AttendanceChanges.findOne({ where: { fkAttendanceId: old.id, reason: "Corrected by principal" } }))
      .toMatchObject({ fromStatus: "Present", toStatus: "Absent", fkActorUserId: admin.id, source: "review" });
    // Future dates stay blocked even for Super Admin.
    const daily = await get(tokens.admin, `/review/daily?classId=${klass.id}&date=${shift(TODAY, -1)}`);
    expect(daily.body.data).toMatchObject({ canEdit: true, windowBypass: true });
    const opsDaily = await get(tokens.ops, `/review/daily?classId=${klass.id}&date=${shift(TODAY, -1)}`);
    expect(opsDaily.body.data.canEdit).toBe(false);
    // Teachers are held to the same window when re-marking a saved day.
    const remark = await send(tokens.teacher, "POST", "/mark", { classId: klass.id, date: shift(TODAY, -1), marks: [{ studentId: kids[0].id, status: "Late" }] });
    expect(remark.status).toBe(409);
    await SchoolSettings.destroy({ where: { fkSchoolId: school.id, key: "attendance" } });

    const history = await get(tokens.admin, "/review/changes?pageSize=5");
    expect(history.body.data.total).toBeGreaterThanOrEqual(1);
    const opsChange = history.body.data.changes.find((c) => c.reason === "Arrived after the register");
    expect(opsChange).toMatchObject({ from: "Absent", to: "Late", source: "review" });
    expect(opsChange.actor.name).toBeTruthy();
    // Teacher re-marks inside the window are also in the history (no reason).
    await send(tokens.teacher, "POST", "/mark", { classId: klass.id, date: TODAY, marks: [{ studentId: kids[3].id, status: "Present" }] });
    const reg = await AttendanceChanges.findOne({ where: { fkStudentId: kids[3].id, source: "register" } });
    expect(reg).toMatchObject({ fromStatus: "Leave", toStatus: "Present", reason: null });
    const filtered = await get(tokens.admin, `/review/changes?q=${encodeURIComponent("Dawood")}`);
    expect(filtered.body.data.changes.every((c) => c.studentName.startsWith("Dawood"))).toBe(true);
  });

  test("monthly report counts working days, Late as attended, and flags low attendance", async () => {
    const { body } = await get(tokens.admin, `/review/monthly?classId=${klass.id}&month=${MONTH}`);
    const sameMonth = [TODAY, shift(TODAY, -1), shift(TODAY, -2)].filter((d) => d.startsWith(MONTH)).length;
    expect(body.data.workingDays).toBe(sameMonth);
    const bina = body.data.students.find((s) => s.studentId === kids[1].id);
    expect(bina.marked).toBe(sameMonth);
    expect(bina.low).toBe(true);
    expect(body.data.threshold).toBe(75);
  });

  test("percentages exclude Leave days; all-leave gives null, not a divide-by-zero", async () => {
    const { attendancePercent } = require("../../utils/attendance");
    expect(attendancePercent({ present: 3, late: 1, absent: 1, leave: 5 })).toBe(80);
    expect(attendancePercent({ present: 0, late: 0, absent: 0, leave: 4 })).toBeNull();
    expect(attendancePercent({})).toBeNull();
    expect(attendancePercent({ present: 1, late: 0, absent: 2 })).toBe(33.3);

    const month = "2025-02";
    const kid = await makeStudent(school.id, other.id, { firstName: "Leaver" });
    const kid2 = await makeStudent(school.id, other.id, { firstName: "Mixed" });
    const rows = [
      ["2025-02-03", "Leave", "Present"], ["2025-02-04", "Leave", "Leave"], ["2025-02-05", "Leave", "Absent"],
    ];
    for (const [date, a, b] of rows) {
      await Attendances.create({ fkSchoolId: school.id, fkStudentId: kid.id, fkClassId: other.id, date, status: a });
      await Attendances.create({ fkSchoolId: school.id, fkStudentId: kid2.id, fkClassId: other.id, date, status: b });
    }
    const { body } = await get(tokens.admin, `/review/monthly?classId=${other.id}&month=${month}`);
    const leaver = body.data.students.find((s) => s.studentId === kid.id);
    const mixed = body.data.students.find((s) => s.studentId === kid2.id);
    expect(leaver).toMatchObject({ leave: 3, percent: null, low: false });
    expect(mixed).toMatchObject({ present: 1, absent: 1, leave: 1, percent: 50, low: true });
    expect(body.data.classPercent).toBe(50);
    const low = await get(tokens.admin, `/review/low?month=${month}&classId=${other.id}`);
    expect(low.body.data.students.map((s) => s.studentId)).toEqual([kid2.id]);
    await Attendances.destroy({ where: { fkStudentId: [kid.id, kid2.id] } });
    await kid.update({ status: "Inactive" });
    await kid2.update({ status: "Inactive" });
  });

  test("management can create a missing mark: reason required, duplicates 409, window rules, logged as a creation", async () => {
    const kid = await makeStudent(school.id, klass.id, { firstName: "Late joiner" });
    const body = { studentId: kid.id, classId: klass.id, date: TODAY, status: "Present" };
    expect((await send(tokens.teacher, "POST", "/review/marks", { ...body, reason: "Teacher try" })).status).toBe(403);
    expect((await send(tokens.ops, "POST", "/review/marks", body)).status).toBe(400);
    expect((await send(tokens.ops, "POST", "/review/marks", { ...body, classId: other.id, reason: "Wrong class" })).status).toBe(400);
    expect((await send(tokens.ops, "POST", "/review/marks", { ...body, date: shift(TODAY, 1), reason: "Future" })).status).toBe(400);
    const made = await send(tokens.ops, "POST", "/review/marks", { ...body, reason: "Joined after the register" });
    expect(made.status).toBe(201);
    const row = await Attendances.findByPk(made.body.data.id);
    expect(row).toMatchObject({ status: "Present", fkCreatedByUserId: ops.id, fkMarkedByUserId: ops.id });
    expect(row.get("created_at")).toBeTruthy();
    expect(await AttendanceChanges.findOne({ where: { fkAttendanceId: row.id } }))
      .toMatchObject({ fromStatus: null, toStatus: "Present", source: "created", reason: "Joined after the register", fkActorUserId: ops.id });
    expect(await AuditLogs.count({ where: { entityType: "attendance", entityId: row.id } })).toBe(1);
    expect((await send(tokens.admin, "POST", "/review/marks", { ...body, reason: "Again" })).status).toBe(409);
    const history = await get(tokens.admin, `/review/changes?q=${encodeURIComponent("Late joiner")}`);
    expect(history.body.data.changes[0]).toMatchObject({ from: null, to: "Present", source: "created" });

    // Outside the window: Ops 409, Super Admin allowed.
    await SchoolSettings.create({ fkSchoolId: school.id, key: "attendance", value: { editWindowDays: 0 } });
    const old = { ...body, date: shift(TODAY, -3), reason: "Paper register found" };
    expect((await send(tokens.ops, "POST", "/review/marks", old)).status).toBe(409);
    expect((await send(tokens.admin, "POST", "/review/marks", old)).status).toBe(201);
    await SchoolSettings.destroy({ where: { fkSchoolId: school.id, key: "attendance" } });
    await Attendances.destroy({ where: { fkStudentId: kid.id } });
    await kid.update({ status: "Inactive" });
  });

  test("low attendance uses the threshold and returns guardian contact", async () => {
    const res = await get(tokens.admin, `/review/low?month=${MONTH}&threshold=75`);
    const bina = res.body.data.students.find((s) => s.studentId === kids[1].id);
    expect(bina).toBeTruthy();
    expect(bina.guardian).toBeTruthy();
    const none = await get(tokens.admin, `/review/low?month=${MONTH}&threshold=1`);
    expect(none.body.data.students.find((s) => s.studentId === kids[1].id)).toBeFalsy();
  });

  test("absentee list covers Absent and Late across classes", async () => {
    const { body } = await get(tokens.admin, `/review/absentees?date=${TODAY}`);
    const mine = body.data.students.filter((s) => s.classId === klass.id);
    expect(mine.map((s) => s.status).sort()).toEqual(["Late", "Late"]);
    expect(body.data.late).toBeGreaterThanOrEqual(2);
  });

  test("reminders: only today, only pending classes, once per day, shown to the teacher", async () => {
    expect((await send(tokens.admin, "POST", "/review/reminders", { classId: klass.id })).status).toBe(409); // already taken
    expect((await send(tokens.admin, "POST", "/review/reminders", { classId: other.id, date: shift(TODAY, -1) })).status).toBe(400);
    const slot = await TimetableSlots.findOne({ where: { fkClassId: klass.id } });
    await TimetableSlots.create({ fkSchoolId: school.id, fkClassId: other.id, fkTeacherId: slot.fkTeacherId, fkSubjectId: slot.fkSubjectId, day: weekdayOf(TODAY), periodIndex: 2 });
    // A timetable slot alone never makes a teacher responsible: no Super Master, no reminder.
    const unassigned = await send(tokens.admin, "POST", "/review/reminders", { classId: other.id });
    expect(unassigned.status).toBe(409);
    expect(unassigned.body.message).toMatch(/no Super Master/);
    await other.update({ fkSuperMasterTeacherId: slot.fkTeacherId });
    const sent = await send(tokens.admin, "POST", "/review/reminders", { classId: other.id });
    expect(sent.status).toBe(201);
    expect(sent.body.data.teacher).toBeTruthy();
    const again = await send(tokens.ops, "POST", "/review/reminders", { classId: other.id });
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already sent/);
    expect(await AttendanceReminders.count({ where: { fkClassId: other.id } })).toBe(1);
    const notices = await request(app, { method: "GET", path: "/api/system-notices", token: tokens.teacher });
    expect(notices.body.data.some((n) => n.id === "attendance-reminder")).toBe(true);
    const today = await get(tokens.admin, "/review/today");
    expect(today.body.data.classes.find((c) => c.classId === other.id).remindedAt).toBeTruthy();
  });

  test("teacher marking: a teacher not linked to the class gets 403; the Super Master may mark at any time of day", async () => {
    const outsider = await makeUser(school.id, "teacher");
    const subject = await Subjects.create({ fkSchoolId: school.id, name: "Art", code: `A${uid()}`.slice(0, 20) });
    await Teachers.create({ fkSchoolId: school.id, fkUserId: outsider.id, fkSubjectId: subject.id, employeeCode: `E${uid()}`.slice(0, 20) });
    const body = { classId: klass.id, date: TODAY, marks: [{ studentId: kids[0].id, status: "Present" }] };
    expect((await send(tokenFor(outsider), "POST", "/mark", body)).status).toBe(403);
    expect((await get(tokenFor(outsider), "/review/today")).status).toBe(403);
    // The timetabled teacher's re-save of an unchanged mark is accepted and writes no change row.
    const before = await AttendanceChanges.count({ where: { fkStudentId: kids[0].id } });
    const same = (await Attendances.findOne({ where: { fkStudentId: kids[0].id, date: TODAY } })).status;
    expect((await send(tokens.teacher, "POST", "/mark", { ...body, marks: [{ studentId: kids[0].id, status: same }] })).status).toBe(200);
    expect(await AttendanceChanges.count({ where: { fkStudentId: kids[0].id } })).toBe(before);
  });

  test("reports reject unknown classes and other schools", async () => {
    const foreign = await makeSchool();
    const theirs = await Classes.create({ fkSchoolId: foreign.school.id, fkSessionId: foreign.session.id, grade: "X", section: "A", label: "X", monthlyTuitionFee: 1, capacity: 1 });
    expect((await get(tokens.admin, `/review/daily?classId=${theirs.id}&date=${TODAY}`)).status).toBe(404);
    expect((await get(tokens.admin, `/review/monthly?classId=${klass.id}&month=2026-13`)).status).toBe(400);
  });
});
