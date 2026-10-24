"use strict";

/**
 * Super Master (EDUVIA-14): one explicitly assigned teacher per class is responsible for
 * its attendance all day; on a day they are absent, the substitute assigned to cover them
 * in that class may take it. Other timetabled teachers get 403. Management is unaffected.
 */
const app = require("../../app");
const {
  sequelize, Attendances, AttendanceReminders, AuditLogs, Classes, Subjects, Teachers, TimetableSlots, TeacherAbsences,
} = require("../../models");
const { today: schoolToday, parse, iso, weekdayOf } = require("../../utils/dates");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent, uid } = require("../helpers/school");
const { request } = require("../helpers/http");

const shift = (date, days) => { const d = parse(date); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
const TODAY = schoolToday();
const TOMORROW = shift(TODAY, 1);
const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("Super Master attendance responsibility", () => {
  let school; let session; let tokens; let t; let klass; let spare; let kid; let spareKid; let subject;

  const mark = (token, classId, studentId, status = "Present", date = TODAY) =>
    call(token, "POST", "/attendances/mark", { classId, date, marks: [{ studentId, status }] });
  const assign = (token, classId, teacherId) => call(token, "PUT", `/attendances/review/super-masters/${classId}`, { teacherId });
  const clearMarks = () => Attendances.destroy({ where: { fkClassId: [klass.id, spare.id] }, force: true });

  async function teacher(name) {
    const user = await makeUser(school.id, "teacher");
    await user.update({ firstName: name });
    const row = await Teachers.create({ fkSchoolId: school.id, fkUserId: user.id, fkSubjectId: subject.id, employeeCode: `E${uid()}`.slice(0, 20) });
    return { user, row, token: tokenFor(user) };
  }

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    const admin = await makeUser(school.id, "super_admin");
    const ops = await makeUser(school.id, "operations_manager");
    tokens = { admin: tokenFor(admin), ops: tokenFor(ops) };
    subject = await Subjects.create({ fkSchoolId: school.id, name: "Maths", code: `M${uid()}`.slice(0, 20) });
    t = { sm: await teacher("Sana"), other: await teacher("Omar"), sub: await teacher("Sadia"), next: await teacher("Nadia") };
    klass = await makeClass(school.id, session.id, "SM 1");
    spare = await makeClass(school.id, session.id, "SM 2");
    kid = await makeStudent(school.id, klass.id, { firstName: "Ali" });
    spareKid = await makeStudent(school.id, spare.id, { firstName: "Bina" });
    // Both the Super Master and "Omar" teach the class; only an explicit assignment makes someone responsible.
    for (const [tt, period] of [[t.other, 1], [t.sm, 2]]) {
      for (const day of [weekdayOf(TODAY), weekdayOf(TOMORROW)]) {
        await TimetableSlots.create({ fkSchoolId: school.id, fkClassId: klass.id, fkTeacherId: tt.row.id, fkSubjectId: subject.id, day, periodIndex: period });
      }
    }
  });

  afterEach(clearMarks);

  test("unassigned class: no teacher can mark, Today's Status says so, reminders are refused, management can still create", async () => {
    expect((await mark(t.other.token, klass.id, kid.id)).status).toBe(403); // first-period teacher: no inference
    const res = await mark(t.sm.token, klass.id, kid.id);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/no active Super Master/);
    const today = await call(tokens.admin, "GET", "/attendances/review/today");
    const row = today.body.data.classes.find((c) => c.classId === klass.id);
    expect(row).toMatchObject({ superMasterState: "unassigned", superMaster: null, teacher: null });
    const remind = await call(tokens.admin, "POST", "/attendances/review/reminders", { classId: klass.id });
    expect(remind.status).toBe(409);
    expect(remind.body.message).toMatch(/no Super Master/);
    const created = await call(tokens.ops, "POST", "/attendances/review/marks", { studentId: kid.id, classId: klass.id, date: TODAY, status: "Present", reason: "Office register" });
    expect(created.status).toBe(201);
  });

  test("assignment: management only, one Super Master per class (DB column), audited; inactive teachers refused", async () => {
    expect((await assign(t.sm.token, klass.id, t.sm.row.id)).status).toBe(403);
    const ok = await assign(tokens.admin, klass.id, t.sm.row.id);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ classId: klass.id, state: "assigned", superMaster: { teacherId: t.sm.row.id } });
    expect(await AuditLogs.count({ where: { entityType: "class_super_master", entityId: klass.id } })).toBe(1);
    // A class can only ever hold one Super Master: the column is a single FK.
    const [cols] = await sequelize.query("SELECT data_type FROM information_schema.columns WHERE table_name='classes' AND column_name='fk_super_master_teacher_id'");
    expect(cols[0].data_type).toBe("integer");
    const resigned = await teacher("Rafi");
    await resigned.row.update({ status: "Resigned" });
    expect((await assign(tokens.admin, spare.id, resigned.row.id)).status).toBe(409);
    expect((await assign(tokens.admin, spare.id, 999999)).status).toBe(404);
    const overview = await call(tokens.ops, "GET", "/attendances/review/super-masters");
    expect(overview.status).toBe(200);
    expect(overview.body.data.teachers.some((x) => x.teacherId === resigned.row.id)).toBe(false);
    expect(overview.body.data.classes.find((c) => c.classId === spare.id).state).toBe("unassigned");
  });

  test("only the Super Master marks; other timetabled teachers get 403; management unaffected", async () => {
    expect((await mark(t.sm.token, klass.id, kid.id)).status).toBe(200);
    const denied = await mark(t.other.token, klass.id, kid.id, "Absent");
    expect(denied.status).toBe(403);
    expect(denied.body.message).toMatch(/Super Master/);
    expect((await mark(tokens.ops, klass.id, kid.id, "Late")).status).toBe(200);
    expect((await mark(tokens.admin, spare.id, spareKid.id)).status).toBe(200); // even an unassigned class
    const resp = await call(t.sm.token, "GET", "/attendances/responsibilities");
    expect(resp.body.data).toEqual([expect.objectContaining({ classId: klass.id, role: "SuperMaster", absent: false })]);
    expect((await call(t.other.token, "GET", "/attendances/responsibilities")).body.data).toEqual([]);
  });

  test("one teacher may be Super Master of several classes", async () => {
    expect((await assign(tokens.admin, spare.id, t.sm.row.id)).status).toBe(200);
    expect((await mark(t.sm.token, spare.id, spareKid.id)).status).toBe(200);
    const resp = await call(t.sm.token, "GET", "/attendances/responsibilities");
    expect(resp.body.data.map((r) => r.classId).sort()).toEqual([klass.id, spare.id].sort());
    expect((await assign(tokens.admin, spare.id, null)).status).toBe(200);
    expect((await mark(t.sm.token, spare.id, spareKid.id)).status).toBe(403);
  });

  test("substitute: valid only on the covered date, and a cancelled absence revokes it", async () => {
    // Super Master absent tomorrow, covered by Sadia in this class.
    expect((await call(tokens.admin, "POST", "/teacher-absences", { teacherId: t.sm.row.id, date: TOMORROW, periods: [2] })).status).toBeLessThan(300);
    const tomorrowAbs = await TeacherAbsences.findOne({ where: { fkTeacherId: t.sm.row.id, date: TOMORROW } });
    expect((await call(tokens.admin, "PUT", `/teacher-absences/${tomorrowAbs.id}/substitute`, { substituteTeacherId: t.sub.row.id })).status).toBe(200);
    expect((await mark(t.sub.token, klass.id, kid.id)).status).toBe(403); // not today
    const tomorrow = await call(t.sub.token, "GET", `/attendances/responsibilities?date=${TOMORROW}`);
    expect(tomorrow.body.data).toEqual([expect.objectContaining({ classId: klass.id, role: "Substitute" })]);

    // Absent today too, covered by Sadia: she may mark today; the Super Master keeps the right as well.
    await call(tokens.admin, "POST", "/teacher-absences", { teacherId: t.sm.row.id, date: TODAY, periods: [2] });
    const todayAbs = await TeacherAbsences.findOne({ where: { fkTeacherId: t.sm.row.id, date: TODAY } });
    expect((await call(tokens.admin, "PUT", `/teacher-absences/${todayAbs.id}/substitute`, { substituteTeacherId: t.sub.row.id })).status).toBe(200);
    expect((await mark(t.sub.token, klass.id, kid.id)).status).toBe(200);
    expect((await mark(t.other.token, klass.id, kid.id, "Absent")).status).toBe(403);
    const status = (await call(tokens.admin, "GET", "/attendances/review/today")).body.data.classes.find((c) => c.classId === klass.id);
    expect(status).toMatchObject({ superMasterAbsent: true, teacher: expect.stringContaining("Sadia"), superMaster: expect.stringContaining("Sana") });
    await clearMarks();

    // Reminder goes to the substitute while the Super Master is away; once per class per day.
    const sent = await call(tokens.admin, "POST", "/attendances/review/reminders", { classId: klass.id });
    expect(sent.status).toBe(201);
    expect(sent.body.data).toMatchObject({ viaSubstitute: true, teacher: expect.stringContaining("Sadia") });
    expect((await call(tokens.ops, "POST", "/attendances/review/reminders", { classId: klass.id })).status).toBe(409);
    expect(await AttendanceReminders.count({ where: { fkClassId: klass.id } })).toBe(1);
    const subMine = await call(t.sub.token, "GET", "/attendances/reminders/mine");
    expect(subMine.body.data).toEqual([expect.objectContaining({ classId: klass.id, role: "Substitute", readAt: null })]);
    expect((await call(t.sm.token, "GET", "/attendances/reminders/mine")).body.data).toEqual([]);

    // Cancelling the absence (existing cancel flow) revokes the substitute and routes the reminder back.
    expect((await call(tokens.admin, "POST", `/teacher-absences/${todayAbs.id}/cancel`)).status).toBe(200);
    expect((await mark(t.sub.token, klass.id, kid.id)).status).toBe(403);
    expect((await call(t.sub.token, "GET", "/attendances/reminders/mine")).body.data).toEqual([]);
    const smMine = await call(t.sm.token, "GET", "/attendances/reminders/mine");
    expect(smMine.body.data).toEqual([expect.objectContaining({ classId: klass.id, role: "SuperMaster" })]);
  });

  test("teacher notices: reminder visible in system notices and bell, read state, gone once taken", async () => {
    const notices = await call(t.sm.token, "GET", "/system-notices");
    expect(notices.body.data.find((n) => n.id === "attendance-reminder").detail).toMatch(/SM 1/);
    expect((await call(t.other.token, "GET", "/system-notices")).body.data.some((n) => n.id === "attendance-reminder")).toBe(false);
    const [mine] = (await call(t.sm.token, "GET", "/attendances/reminders/mine")).body.data;
    expect((await call(t.other.token, "POST", `/attendances/reminders/${mine.id}/read`)).status).toBe(404);
    const read = await call(t.sm.token, "POST", `/attendances/reminders/${mine.id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
    expect((await mark(t.sm.token, klass.id, kid.id)).status).toBe(200);
    expect((await call(t.sm.token, "GET", "/system-notices")).body.data.some((n) => n.id === "attendance-reminder")).toBe(false);
    expect((await call(t.sm.token, "GET", "/attendances/reminders/mine")).body.data[0].taken).toBe(true);
  });

  test("reassignment: old Super Master loses rights at once, new one gains them; inactive SM blocks marking", async () => {
    const res = await assign(tokens.admin, klass.id, t.next.row.id);
    expect(res.status).toBe(200);
    const log = await AuditLogs.findOne({ where: { entityType: "class_super_master", entityId: klass.id }, order: [["id", "DESC"]] });
    expect(log.metadata).toMatchObject({ fromTeacherId: t.sm.row.id, toTeacherId: t.next.row.id });
    expect((await mark(t.sm.token, klass.id, kid.id)).status).toBe(403);
    expect((await mark(t.next.token, klass.id, kid.id)).status).toBe(200);
    // Today's open reminder now belongs to the new Super Master.
    expect((await call(t.next.token, "GET", "/attendances/reminders/mine")).body.data).toHaveLength(1);
    expect((await call(t.sm.token, "GET", "/attendances/reminders/mine")).body.data).toHaveLength(0);

    await t.next.row.update({ status: "Resigned" });
    expect((await mark(t.next.token, klass.id, kid.id, "Late")).status).toBe(403);
    const row = (await call(tokens.admin, "GET", "/attendances/review/today")).body.data.classes.find((c) => c.classId === klass.id);
    expect(row.superMasterState).toBe("inactive");
    await t.next.row.update({ status: "Active" });
    expect((await Classes.findByPk(klass.id)).fkSuperMasterTeacherId).toBe(t.next.row.id);
  });
});
