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
  Parents,
  StudentParents,
  Attendances,
  StudentStatusEvents,
  StudentFeeMonths,
  Exams,
} = require("../../models");
const studentService = require("../../services/student.service");
const leaveService = require("../../services/leave.service");
const reportService = require("../../services/report.service");
const examService = require("../../services/exam.service");
const feeService = require("../../services/fee.service");
const documentService = require("../../services/document.service");
const { generateToken } = require("../../utils");
const { today } = require("../../utils/dates");
const { USER_ROLES } = require("../../constants");

function httpRaw({ method, path, token, body }) {
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks);
            const type = res.headers["content-type"] || "";
            resolve({
              status: res.statusCode,
              type,
              body: type.includes("application/json") ? JSON.parse(raw.toString() || "{}") : raw,
            });
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

function tokenFor(user, school) {
  return generateToken({ id: user.id, schoolId: school.id, role: user.role, email: user.email }, "1h");
}

async function buildSchool() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const school = await Schools.create({ name: `Life School ${stamp}`, email: `life-${stamp}@example.com`, code: `LF${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  const admin = await Users.create({
    fkSchoolId: school.id, firstName: "Ada", lastName: "Admin", email: `life-admin-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.SUPER_ADMIN, status: "active",
  });
  const ops = await Users.create({
    fkSchoolId: school.id, firstName: "Omar", lastName: "Ops", email: `life-ops-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.OPERATIONS_MANAGER, status: "active",
  });
  const accountant = await Users.create({
    fkSchoolId: school.id, firstName: "Ayesha", lastName: "Accounts", email: `life-acc-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.ACCOUNTANT, status: "active",
  });
  const teacherUser = await Users.create({
    fkSchoolId: school.id, firstName: "Hina", lastName: "Teacher", email: `life-tch-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.TEACHER, status: "active",
  });
  const parentUser = await Users.create({
    fkSchoolId: school.id, firstName: "Sana", lastName: "Khan", email: `life-par-${stamp}@example.com`,
    password: "hashed", role: USER_ROLES.PARENT, status: "active",
  });
  const subject = await Subjects.create({ fkSchoolId: school.id, name: "Mathematics", code: `LM${stamp}`.slice(0, 20) });
  const teacher = await Teachers.create({
    fkSchoolId: school.id, fkUserId: teacherUser.id, fkSubjectId: subject.id, employeeCode: `LT${stamp}`.slice(0, 20),
  });
  const klass = await Classes.create({
    fkSchoolId: school.id, fkSessionId: session.id, grade: "5", section: "A", label: "Class 5-A", monthlyTuitionFee: 1000, capacity: 30,
  });
  const next = await Classes.create({
    fkSchoolId: school.id, fkSessionId: session.id, grade: "6", section: "A", label: "Class 6-A", monthlyTuitionFee: 1200, capacity: 1,
  });
  const student = await Students.create({
    fkSchoolId: school.id, fkClassId: klass.id, admissionNo: `ADM-${stamp}`.slice(0, 20),
    firstName: "Ayaan", lastName: "Khan", gender: "Male", dateOfBirth: "2015-01-01", admissionDate: "2026-04-01", status: "Active",
  });
  const parent = await Parents.create({ fkSchoolId: school.id, fkUserId: parentUser.id, fatherName: "Imran Khan" });
  await StudentParents.create({ fkStudentId: student.id, fkParentId: parent.id, relationshipType: "Father", isPrimary: true });
  const actor = { id: admin.id, schoolId: school.id, role: admin.role, email: admin.email };
  return { school, session, admin, ops, accountant, teacherUser, teacher, parentUser, subject, klass, next, student, actor, stamp };
}

describe("lifecycle, leave, reports, and documents", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("status changes keep a reason and a date, and a plain update cannot set status", async () => {
    const fx = await buildSchool();
    await expect(studentService.update(fx.student.id, fx.school.id, { status: "Withdrawn" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(studentService.changeStatus(fx.actor, fx.student.id, { status: "Graduated", reason: "Completed", effectiveOn: "2027-03-31" })).rejects.toMatchObject({ statusCode: 400 });
    const struck = await studentService.changeStatus(fx.actor, fx.student.id, {
      status: "StruckOff", reason: "Left without notice", effectiveOn: "2026-10-01", academicStatus: "Incomplete",
    });
    expect(struck.status).toBe("StruckOff");
    expect(struck.statusEvents[0].financialStatus).toMatch(/Outstanding/);
    expect(struck.statusEvents[0].fkActorUserId).toBe(fx.admin.id);
    await expect(StudentStatusEvents.create({
      fkSchoolId: fx.school.id, fkStudentId: fx.student.id, fromStatus: "StruckOff", toStatus: "Active", effectiveOn: "2026-10-02",
    })).rejects.toThrow();
  });

  test("promotion records the previous class and stops at capacity", async () => {
    const fx = await buildSchool();
    await Students.create({
      fkSchoolId: fx.school.id, fkClassId: fx.next.id, admissionNo: `FULL-${fx.stamp}`.slice(0, 20),
      firstName: "Full", lastName: "Seat", gender: "Female", dateOfBirth: "2015-02-02", admissionDate: "2026-04-01", status: "Active",
    });
    await expect(studentService.promote(fx.actor, fx.student.id, { classId: fx.next.id, date: "2026-10-01" })).rejects.toMatchObject({ statusCode: 409 });
    const room = await Classes.create({
      fkSchoolId: fx.school.id, fkSessionId: fx.session.id, grade: "6", section: "B", label: "Class 6-B", monthlyTuitionFee: 1200, capacity: 20,
    });
    const promoted = await studentService.promote(fx.actor, fx.student.id, { classId: room.id, date: "2026-10-01" });
    expect(promoted.fkClassId).toBe(room.id);
    expect(promoted.promotions).toHaveLength(1);
    expect(promoted.promotions[0].fkFromClassId).toBe(fx.klass.id);
  });

  test("leave approval does not mark attendance, and review is limited to operations roles", async () => {
    const fx = await buildSchool();
    const before = await Attendances.count({ where: { fkStudentId: fx.student.id } });
    const parent = { id: fx.parentUser.id, schoolId: fx.school.id, role: fx.parentUser.role, email: fx.parentUser.email };
    const request = await leaveService.create(parent, {
      studentId: fx.student.id, startDate: "2026-10-12", endDate: "2026-10-13", reason: "Family travel",
    });
    await expect(leaveService.create(parent, {
      studentId: fx.student.id, startDate: "2026-10-15", endDate: "2026-10-14", reason: "Backwards",
    })).rejects.toMatchObject({ statusCode: 400 });
    const reviewed = await leaveService.review(
      { id: fx.ops.id, schoolId: fx.school.id, role: fx.ops.role, email: fx.ops.email },
      request.id,
      { status: "Approved", reviewNotes: "Noted" },
    );
    expect(reviewed.status).toBe("Approved");
    expect(await Attendances.count({ where: { fkStudentId: fx.student.id } })).toBe(before);

    const denied = await httpRaw({
      method: "POST",
      path: `/api/leave-requests/${request.id}/review`,
      token: tokenFor(fx.parentUser, fx.school),
      body: { status: "Rejected" },
    });
    expect(denied.status).toBe(403);
    const teacherDenied = await httpRaw({
      method: "POST",
      path: "/api/leave-requests",
      token: tokenFor(fx.teacherUser, fx.school),
      body: { studentId: fx.student.id, startDate: "2026-11-01", endDate: "2026-11-02", reason: "Teacher cannot request" },
    });
    expect(teacherDenied.status).toBe(403);
  });

  test("the dashboard omits fee and finance figures from operations managers", async () => {
    const fx = await buildSchool();
    const month = today().slice(0, 7);
    await StudentFeeMonths.create({
      fkSchoolId: fx.school.id, fkStudentId: fx.student.id, month, feeType: "Tuition",
      baseAmount: 1000, discountAmount: 0, netAmount: 1000, paidAmount: 0, status: "Unpaid",
    });
    await feeService.recordPayment(fx.actor, { studentId: fx.student.id, amount: 1000, paidOn: today(), method: "Cash" });
    const adminView = await reportService.dashboard(fx.actor);
    const opsView = await reportService.dashboard({ id: fx.ops.id, schoolId: fx.school.id, role: fx.ops.role, email: fx.ops.email });
    expect(adminView.cards.fees.collectedThisMonth).toBeGreaterThan(0);
    expect(adminView.graphs.monthlyFeeCollection.length).toBeGreaterThan(0);
    expect(adminView.graphs.studentsByClass.length).toBeGreaterThan(0);
    expect(opsView.cards.students.active).toBeGreaterThan(0);
    expect(opsView.cards.fees).toBeUndefined();
    expect(opsView.graphs.monthlyFeeCollection).toBeUndefined();
    expect(opsView.graphs.paidVsUnpaid).toBeUndefined();
    expect(opsView.graphs.incomeVsExpenses).toBeUndefined();
    expect(opsView.graphs.examinationPerformance).toEqual([]);
    const blocked = await httpRaw({ method: "GET", path: "/api/reports/dashboard", token: tokenFor(fx.accountant, fx.school) });
    expect(blocked.status).toBe(403);
  });

  test("a published result can be downloaded without a rank, and unpaid fees withhold the parent copy", async () => {
    const fx = await buildSchool();
    const exam = await examService.create(fx.actor, {
      classId: fx.klass.id, name: "Midterm", subjects: [{ subjectId: fx.subject.id, maxScore: 100, teacherId: fx.teacher.id }],
    });
    const sheet = exam.markSheets[0];
    await examService.updateRows(fx.actor, sheet.id, [{ studentId: fx.student.id, score: 95 }]);
    await examService.transition(fx.actor, sheet.id, "submit");
    await examService.transition(fx.actor, sheet.id, "verify");
    await examService.transition(fx.actor, sheet.id, "publish");
    const dmc = await examService.dmc(fx.actor, exam.id, fx.student.id);
    expect(dmc.grade).toBe("A+");
    expect(dmc.passed).toBe(true);
    expect(dmc.rank).toBeUndefined();
    const pdf = await documentService.dmcPdf(fx.actor, exam.id, fx.student.id);
    expect(pdf.slice(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString()).not.toMatch(/Rank/);

    await StudentFeeMonths.create({
      fkSchoolId: fx.school.id, fkStudentId: fx.student.id, month: "2026-04", feeType: "Tuition",
      baseAmount: 1000, discountAmount: 0, netAmount: 1000, paidAmount: 0, status: "Unpaid",
    });
    const stored = await Exams.findByPk(exam.id);
    await stored.update({ feeMonth: "2026-04" });
    const parent = { id: fx.parentUser.id, schoolId: fx.school.id, role: fx.parentUser.role, email: fx.parentUser.email };
    await expect(examService.dmc(parent, exam.id, fx.student.id)).rejects.toMatchObject({ statusCode: 403 });
    const response = await httpRaw({
      method: "GET",
      path: `/api/exams/${exam.id}/dmc?studentId=${fx.student.id}&format=pdf`,
      token: tokenFor(fx.admin, fx.school),
    });
    expect(response.status).toBe(200);
    expect(response.type).toContain("application/pdf");
  });

  test("excel import pays through the ledger once and skips a repeated reference", async () => {
    const fx = await buildSchool();
    const XLSX = require("xlsx");
    await StudentFeeMonths.create({
      fkSchoolId: fx.school.id, fkStudentId: fx.student.id, month: "2026-04", feeType: "Tuition",
      baseAmount: 1000, discountAmount: 0, netAmount: 1000, paidAmount: 0, status: "Unpaid",
    });
    const inactive = await Students.create({
      fkSchoolId: fx.school.id, fkClassId: fx.klass.id, admissionNo: `OFF-${fx.stamp}`.slice(0, 20),
      firstName: "Old", lastName: "Student", gender: "Male", dateOfBirth: "2014-01-01", admissionDate: "2025-04-01", status: "Inactive",
    });
    const sheet = XLSX.utils.aoa_to_sheet([
      ["admission number", "student name", "class", "month", "amount", "payment date", "receipt/reference", "method", "notes"],
      [fx.student.admissionNo, "Wrong Name", "Class 9", "2026-04", 400, "2026-10-09", `REF-${fx.stamp}`, "Cash", "counter"],
      [inactive.admissionNo, "Old Student", "Class 5-A", "2026-04", 100, "2026-10-09", `BAD-${fx.stamp}`, "Cash", ""],
      ["NOBODY", "Nobody", "Class 5-A", "2026-04", 100, "2026-10-09", `MISS-${fx.stamp}`, "Cash", ""],
      [fx.student.admissionNo, "Ayaan", "Class 5-A", "", "", "", "", "Cash", ""],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Fees");
    const contentBase64 = XLSX.write(book, { type: "base64", bookType: "xlsx" });
    const first = await feeService.importPayments(fx.actor, { filename: "fees.xlsx", contentBase64 });
    expect(first.success).toBe(1);
    expect(first.failed).toBe(3);
    const second = await feeService.importPayments(fx.actor, { filename: "fees.xlsx", contentBase64 });
    expect(second.skipped).toBe(1);
    expect(second.success).toBe(0);
    const month = await StudentFeeMonths.findOne({ where: { fkStudentId: fx.student.id, month: "2026-04" } });
    expect(Number(month.paidAmount)).toBe(400);
    expect(month.status).toBe("Partially Paid");
  });

  test("a receipt pdf is the receipt itself", async () => {
    const fx = await buildSchool();
    await StudentFeeMonths.create({
      fkSchoolId: fx.school.id, fkStudentId: fx.student.id, month: today().slice(0, 7), feeType: "Tuition",
      baseAmount: 500, discountAmount: 0, netAmount: 500, paidAmount: 0, status: "Unpaid",
    });
    const recorded = await feeService.recordPayment(fx.actor, { studentId: fx.student.id, amount: 500, paidOn: today(), method: "Cash" });
    const response = await httpRaw({
      method: "GET",
      path: `/api/fees/payments/${recorded.receipt.id}/receipt?format=pdf`,
      token: tokenFor(fx.admin, fx.school),
    });
    expect(response.status).toBe(200);
    expect(response.body.slice(0, 5).toString()).toBe("%PDF-");
    expect(response.body.toString()).toContain(recorded.receipt.receiptNo);
    const json = await httpRaw({
      method: "GET",
      path: `/api/fees/payments/${recorded.receipt.id}/receipt`,
      token: tokenFor(fx.admin, fx.school),
    });
    expect(json.body.data.receiptNo).toBe(recorded.receipt.receiptNo);
  });
});
