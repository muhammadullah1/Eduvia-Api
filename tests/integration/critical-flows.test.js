"use strict";

const http = require("http");
const app = require("../../app");
const {
  sequelize,
  Schools,
  AcademicSessions,
  Users,
  Subjects,
  Teachers,
  Classes,
  Students,
  TimetableSlots,
  PlannedChapters,
  Attendances,
  TeacherAbsences,
  DailyLessons,
  MarkSheets,
  StudentFeeMonths,
} = require("../../models");
const applicationService = require("../../services/application.service");
const attendanceService = require("../../services/attendance.service");
const teacherAbsenceService = require("../../services/teacher_absence.service");
const dailyLessonService = require("../../services/daily_lesson.service");
const examService = require("../../services/exam.service");
const feeService = require("../../services/fee.service");
const settingsService = require("../../services/settings.service");
const userService = require("../../services/user.service");
const validate = require("../../middlewares/validate");
const applicationValidation = require("../../validations/application");
const attendanceValidation = require("../../validations/attendance");
const { generateToken } = require("../../utils");
const { USER_ROLES, SHEET_STATUS, FEE_MONTH_STATUS } = require("../../constants");
const ApiError = require("../../utils/ApiError");

const MONDAY = "2026-10-05";

function runValidate(schema, req) {
  return new Promise((resolve, reject) => {
    validate(schema)(req, {}, (err) => (err ? reject(err) : resolve()));
  });
}

function httpJson({ method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString();
            resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function buildSchool() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const school = await Schools.create({ name: `Test School ${stamp}`, email: `school-${stamp}@example.com`, code: `TS${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  const admin = await Users.create({
    fkSchoolId: school.id,
    firstName: "Ada",
    lastName: "Admin",
    email: `admin-${stamp}@example.com`,
    password: "hashed",
    role: USER_ROLES.SUPER_ADMIN,
    status: "active",
  });
  const ops = await Users.create({
    fkSchoolId: school.id,
    firstName: "Omar",
    lastName: "Ops",
    email: `ops-${stamp}@example.com`,
    password: "hashed",
    role: USER_ROLES.OPERATIONS_MANAGER,
    status: "active",
  });
  const subject = await Subjects.create({ fkSchoolId: school.id, name: "Mathematics", code: `M${stamp}`.slice(0, 20) });
  const teacherUser = await Users.create({
    fkSchoolId: school.id,
    firstName: "Hina",
    lastName: "Teacher",
    email: `teacher-${stamp}@example.com`,
    password: "hashed",
    role: USER_ROLES.TEACHER,
    status: "active",
  });
  const coverUser = await Users.create({
    fkSchoolId: school.id,
    firstName: "Bilal",
    lastName: "Cover",
    email: `cover-${stamp}@example.com`,
    password: "hashed",
    role: USER_ROLES.TEACHER,
    status: "active",
  });
  const teacher = await Teachers.create({
    fkSchoolId: school.id,
    fkUserId: teacherUser.id,
    fkSubjectId: subject.id,
    employeeCode: `E${stamp}`.slice(0, 20),
  });
  const cover = await Teachers.create({
    fkSchoolId: school.id,
    fkUserId: coverUser.id,
    fkSubjectId: subject.id,
    employeeCode: `C${stamp}`.slice(0, 20),
  });
  const klass = await Classes.create({
    fkSchoolId: school.id,
    fkSessionId: session.id,
    grade: "5",
    section: "A",
    label: "Class 5-A",
    monthlyTuitionFee: 1000,
    capacity: 30,
  });
  await TimetableSlots.create({
    fkSchoolId: school.id,
    fkClassId: klass.id,
    fkTeacherId: teacher.id,
    fkSubjectId: subject.id,
    day: "Monday",
    periodIndex: 1,
  });
  const actor = { id: admin.id, schoolId: school.id, role: admin.role, email: admin.email };
  const teacherActor = { id: teacherUser.id, schoolId: school.id, role: teacherUser.role, email: teacherUser.email };
  const opsActor = { id: ops.id, schoolId: school.id, role: ops.role, email: ops.email };
  return { school, session, admin, ops, subject, teacher, cover, klass, actor, teacherActor, opsActor, stamp };
}

describe("schema-aligned critical flows", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("enrollment links a parent, opens a fee month, and refuses a full class", async () => {
    const fx = await buildSchool();
    const created = await applicationService.create(fx.school.id, {
      name: "Ayaan Khan",
      fkClassId: fx.klass.id,
      guardian: "Sana Khan",
      phone: "03001234567",
      email: `parent-${fx.stamp}@example.com`,
      dob: "2016-01-15",
      gender: "Male",
      guardianRelation: "Mother",
    });
    expect(created.status).toBe("New");
    expect(created.fkClassId).toBe(fx.klass.id);

    await expect(applicationService.enroll(created.id, fx.school.id, {}, fx.actor)).rejects.toMatchObject({
      statusCode: 400,
    });

    await applicationService.decide(created.id, fx.school.id, "Admit");
    const enrolled = await applicationService.enroll(created.id, fx.school.id, {}, fx.actor);
    expect(enrolled.application.status).toBe("Enrolled");
    expect(enrolled.application.enrolledStudentId).toBe(enrolled.student.id);
    expect(enrolled.student.admissionNo).toMatch(/^CLS\d{4}$/);

    const months = await StudentFeeMonths.findAll({ where: { fkStudentId: enrolled.student.id } });
    expect(months.length).toBeGreaterThan(0);
    expect(months[0].status).toBe(FEE_MONTH_STATUS.UNPAID);

    const { Parents, StudentParents } = require("../../models");
    const links = await StudentParents.findAll({ where: { fkStudentId: enrolled.student.id } });
    expect(links).toHaveLength(1);
    expect(links[0].relationshipType).toBe("Mother");
    const parent = await Parents.findByPk(links[0].fkParentId);
    expect(parent).toBeTruthy();

    await fx.klass.update({ capacity: 1 });
    const second = await applicationService.create(fx.school.id, {
      name: "Zara Khan",
      fkClassId: fx.klass.id,
      guardian: "Sana Khan",
      phone: "03001234567",
      email: `parent-${fx.stamp}@example.com`,
      dob: "2017-02-02",
      gender: "Female",
    });
    await applicationService.decide(second.id, fx.school.id, "Admit");
    await expect(applicationService.enroll(second.id, fx.school.id, {}, fx.actor)).rejects.toMatchObject({ statusCode: 409 });
  });

  test("attendance stores Leave and records who changed it", async () => {
    const fx = await buildSchool();
    const student = await Students.create({
      fkSchoolId: fx.school.id,
      fkClassId: fx.klass.id,
      admissionNo: `CLS9001${fx.stamp}`.slice(0, 20),
      firstName: "Rayan",
      lastName: "Ali",
      gender: "Male",
      dateOfBirth: "2015-05-05",
      admissionDate: "2026-04-01",
      status: "Active",
    });
    await attendanceService.markMany(fx.school.id, {
      classId: fx.klass.id,
      date: MONDAY,
      marks: [{ studentId: student.id, status: "Present" }],
    }, fx.actor);
    await attendanceService.markMany(fx.school.id, {
      classId: fx.klass.id,
      date: MONDAY,
      marks: [{ studentId: student.id, status: "Leave" }],
    }, fx.actor);
    const row = await Attendances.findOne({ where: { fkStudentId: student.id, date: MONDAY } });
    expect(row.status).toBe("Leave");
    expect(row.fkMarkedByUserId).toBe(fx.actor.id);
    expect(row.fkSchoolId).toBe(fx.school.id);
  });

  test("teacher absence is one row per period and a busy substitute is rejected", async () => {
    const fx = await buildSchool();
    const rows = await teacherAbsenceService.markAbsent(fx.actor, {
      teacherId: fx.teacher.id,
      date: MONDAY,
      periods: [1],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("Pending");
    expect(rows[0].periodIndex).toBe(1);
    expect(rows[0].fkClassId).toBe(fx.klass.id);

    await expect(
      teacherAbsenceService.assignSubstitute(fx.actor, rows[0].id, { substituteTeacherId: fx.cover.id }),
    ).resolves.toMatchObject({ status: "Covered" });

    const otherClass = await Classes.create({
      fkSchoolId: fx.school.id,
      fkSessionId: fx.session.id,
      grade: "5",
      section: "B",
      label: "Class 5-B",
      monthlyTuitionFee: 1000,
      capacity: 30,
    });
    await TimetableSlots.create({
      fkSchoolId: fx.school.id,
      fkClassId: otherClass.id,
      fkTeacherId: fx.cover.id,
      fkSubjectId: fx.subject.id,
      day: "Monday",
      periodIndex: 2,
    });
    await TimetableSlots.create({
      fkSchoolId: fx.school.id,
      fkClassId: fx.klass.id,
      fkTeacherId: fx.teacher.id,
      fkSubjectId: fx.subject.id,
      day: "Monday",
      periodIndex: 2,
    });
    const other = await teacherAbsenceService.markAbsent(fx.actor, {
      teacherId: fx.teacher.id,
      date: MONDAY,
      periods: [2],
    });
    await expect(
      teacherAbsenceService.assignSubstitute(fx.actor, other[0].id, { substituteTeacherId: fx.cover.id }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      TeacherAbsences.create({
        fkSchoolId: fx.school.id,
        fkTeacherId: fx.teacher.id,
        date: MONDAY,
        periodIndex: 1,
        status: "Pending",
      }),
    ).rejects.toThrow();
  });

  test("a daily lesson is stored as submitted and keeps classwork and the chapter link", async () => {
    const fx = await buildSchool();
    const chapter = await PlannedChapters.create({
      fkSchoolId: fx.school.id,
      fkSessionId: fx.session.id,
      fkClassId: fx.klass.id,
      fkSubjectId: fx.subject.id,
      chapterNo: 1,
      title: "Fractions",
    });
    const lesson = await dailyLessonService.create(fx.teacherActor, {
      classId: fx.klass.id,
      plannedChapterId: chapter.id,
      date: MONDAY,
      classwork: "Exercise 1",
      homework: "Exercise 2",
    });
    const stored = await DailyLessons.findByPk(lesson.id);
    expect(stored.reviewStatus).toBe("Submitted");
    expect(stored.classwork).toBe("Exercise 1");
    expect(stored.fkChapterId).toBe(chapter.id);
    expect(stored.fkSubmittedByUserId).toBe(fx.teacherActor.id);
  });

  test("a mark sheet can be verified", async () => {
    const fx = await buildSchool();
    const student = await Students.create({
      fkSchoolId: fx.school.id,
      fkClassId: fx.klass.id,
      admissionNo: `CLS8001${fx.stamp}`.slice(0, 20),
      firstName: "Noor",
      lastName: "Ali",
      gender: "Female",
      dateOfBirth: "2015-03-03",
      admissionDate: "2026-04-01",
      status: "Active",
    });
    const exam = await examService.create(fx.actor, {
      classId: fx.klass.id,
      name: "Midterm",
      feeMonth: "2026-10",
      subjects: [{ subjectId: fx.subject.id, maxScore: 100 }],
    });
    const sheet = exam.markSheets[0];
    await examService.updateRows(fx.actor, sheet.id, [{ studentId: student.id, score: 80 }]);
    await examService.transition(fx.actor, sheet.id, "submit");
    const verified = await examService.transition(fx.actor, sheet.id, "verify");
    expect(verified.status).toBe(SHEET_STATUS.VERIFIED);
    const row = await MarkSheets.findByPk(sheet.id);
    expect(row.status).toBe("Verified");
  });

  test("a fee payment clears the oldest month first and a repeated key does not pay twice", async () => {
    const fx = await buildSchool();
    const student = await Students.create({
      fkSchoolId: fx.school.id,
      fkClassId: fx.klass.id,
      admissionNo: `CLS7001${fx.stamp}`.slice(0, 20),
      firstName: "Daniyal",
      lastName: "Raza",
      gender: "Male",
      dateOfBirth: "2014-04-04",
      admissionDate: "2026-04-01",
      status: "Active",
    });
    const first = await feeService.recordPayment(fx.actor, {
      studentId: student.id,
      amount: 500,
      paidOn: "2026-10-09",
      method: "Cash",
      idempotencyKey: `pay-${fx.stamp}`,
    });
    expect(first.duplicate).toBe(false);
    expect(first.receipt.allocationMode).toBe("auto");
    const months = await StudentFeeMonths.findAll({ where: { fkStudentId: student.id }, order: [["month", "ASC"]] });
    expect(months[0].month.startsWith("2026-04")).toBe(true);
    expect(months[0].status).toBe(FEE_MONTH_STATUS.PARTIALLY_PAID);
    expect(Number(months[0].paidAmount)).toBe(500);
    expect(months[1].status).toBe(FEE_MONTH_STATUS.UNPAID);

    const again = await feeService.recordPayment(fx.actor, {
      studentId: student.id,
      amount: 500,
      paidOn: "2026-10-09",
      method: "Cash",
      idempotencyKey: `pay-${fx.stamp}`,
    });
    expect(again.duplicate).toBe(true);
    const payments = await sequelize.models.fee_payments.count({ where: { idempotencyKey: `pay-${fx.stamp}` } });
    expect(payments).toBe(1);
  });

  test("validation rejects an application without a class and an attendance status outside the contract", async () => {
    await expect(runValidate(applicationValidation.validateCreate, {
      body: { name: "A", guardian: "B", phone: "1", dob: "2016-01-01", gender: "Male" },
    })).rejects.toBeInstanceOf(ApiError);

    await expect(runValidate(attendanceValidation.validateMark, {
      body: { classId: 1, date: MONDAY, marks: [{ studentId: 1, status: "Late" }] },
    })).rejects.toBeInstanceOf(ApiError);
  });

  test("an operations manager cannot write fee settings", async () => {
    const fx = await buildSchool();
    await expect(settingsService.update(fx.opsActor, "fees", { dueDay: 12 })).rejects.toMatchObject({ statusCode: 403 });
    const token = generateToken({ id: fx.ops.id, schoolId: fx.school.id, role: fx.ops.role, email: fx.ops.email }, "1h");
    const res = await httpJson({
      method: "PUT",
      path: "/api/settings/fees",
      token,
      body: { dueDay: 12 },
    });
    expect(res.status).toBe(403);
  });

  test("login refuses an email that belongs to two schools", async () => {
    const first = await buildSchool();
    const second = await buildSchool();
    const email = `shared-${first.stamp}@example.com`;
    await Users.create({
      fkSchoolId: first.school.id,
      firstName: "Same",
      lastName: "Person",
      email,
      password: "hashed",
      role: USER_ROLES.TEACHER,
      status: "active",
    });
    await Users.create({
      fkSchoolId: second.school.id,
      firstName: "Same",
      lastName: "Person",
      email,
      password: "hashed",
      role: USER_ROLES.TEACHER,
      status: "active",
    });
    await expect(userService.getByEmailWithPassword(email)).rejects.toMatchObject({ statusCode: 409 });
  });

  test("the blocked user status value is block", async () => {
    const fx = await buildSchool();
    await fx.admin.update({ status: "block" });
    const stored = await Users.findByPk(fx.admin.id);
    expect(stored.status).toBe("block");
    await expect(fx.admin.update({ status: "blocked" })).rejects.toThrow();
  });
});
