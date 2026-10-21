"use strict";

const dailyTestService = require("../../services/daily_test.service");
const {
  sequelize,
  Schools,
  AcademicSessions,
  Classes,
  Subjects,
  TimetableSlots,
  Users,
  DailyTestSchedules,
  Students,
  Parents,
  StudentParents,
  MonthlyStudentSummaries,
} = require("../../models");
const { USER_ROLES } = require("../../constants");

async function fixture() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const school = await Schools.create({
    name: `Daily Test ${stamp}`,
    email: `dt-${stamp}@test.local`,
    code: `DT${stamp}`.slice(0, 20),
  });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  const klass = await Classes.create({
    fkSchoolId: school.id,
    fkSessionId: session.id,
    grade: "Grade 1",
    section: "Main",
    label: "Grade 1",
    periodCount: 8,
    monthlyFee: 0,
  });
  const english = await Subjects.create({
    fkSchoolId: school.id,
    name: "English",
    code: "ENG",
  });
  const biology = await Subjects.create({
    fkSchoolId: school.id,
    name: "Biology",
    code: "BIO",
  });
  const user = await Users.create({
    fkSchoolId: school.id,
    firstName: "Ops",
    lastName: "User",
    email: `ops-${stamp}@test.local`,
    password: "hashed-password",
    role: USER_ROLES.OPERATIONS_MANAGER,
    status: "active",
  });
  return {
    school,
    klass,
    english,
    biology,
    actor: {
      id: user.id,
      schoolId: school.id,
      email: user.email,
      role: user.role,
    },
  };
}

describe("daily test schedule", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("rejects a subject the class does not take and stores nothing", async () => {
    const fx = await fixture();
    await expect(
      dailyTestService.saveSchedule(fx.actor, {
        classId: fx.klass.id,
        subjectId: fx.biology.id,
        weekday: "Monday",
        periodIndex: 1,
        maxScore: 20,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Grade 1 does not take Biology.",
    });
    const rows = await DailyTestSchedules.findAll({
      where: { fkClassId: fx.klass.id },
    });
    expect(rows).toHaveLength(0);
  });

  test("saves when the subject is on the class timetable", async () => {
    const fx = await fixture();
    await TimetableSlots.create({
      fkSchoolId: fx.school.id,
      fkClassId: fx.klass.id,
      fkSubjectId: fx.english.id,
      day: "Monday",
      periodIndex: 1,
      startTime: "08:00:00",
    });
    const saved = await dailyTestService.saveSchedule(fx.actor, {
      classId: fx.klass.id,
      subjectId: fx.english.id,
      weekday: "Monday",
      periodIndex: 1,
      maxScore: 20,
    });
    expect(saved.fkSubjectId).toBe(fx.english.id);
    const rows = await DailyTestSchedules.findAll({
      where: { fkClassId: fx.klass.id, fkSubjectId: fx.english.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].dayOfWeek).toBe("Monday");
  });

  test("marks with an absent student, monthly fail flag, and parents see published tests only", async () => {
    const fx = await fixture();
    await TimetableSlots.create({
      fkSchoolId: fx.school.id, fkClassId: fx.klass.id, fkSubjectId: fx.english.id,
      day: "Monday", periodIndex: 1, startTime: "08:00:00",
    });
    const make = (firstName, index) => Students.create({
      fkSchoolId: fx.school.id, fkClassId: fx.klass.id, admissionNo: `DT${index}-${fx.school.id}`.slice(0, 20),
      firstName, lastName: "Test", gender: "Male", dateOfBirth: "2019-01-01", admissionDate: "2026-04-01", status: "Active",
    });
    const pass = await make("Pass", 1);
    const absent = await make("Absent", 2);
    await dailyTestService.saveSchedule(fx.actor, { classId: fx.klass.id, subjectId: fx.english.id, weekday: "Monday", maxScore: 20 });
    await dailyTestService.generateMonth(fx.actor, { month: "2026-09" });
    await dailyTestService.generateMonth(fx.actor, { month: "2026-10" });
    const tests = await dailyTestService.list(fx.actor, { month: "2026-09" });
    expect(tests.map((t) => t.month)).toEqual(["2026-09", "2026-09", "2026-09", "2026-09"]);

    await expect(dailyTestService.saveMarks(fx.actor, tests[0].id, [{ studentId: absent.id, score: 5, absent: true }]))
      .rejects.toMatchObject({ statusCode: 400 });
    for (const test of tests.slice(0, 2)) {
      await dailyTestService.saveMarks(fx.actor, test.id, [
        { studentId: pass.id, score: 18 },
        { studentId: absent.id, score: null, absent: true },
      ]);
    }
    const flaggedRow = await MonthlyStudentSummaries.findOne({ where: { fkStudentId: absent.id, month: "2026-09" } });
    expect(flaggedRow).toMatchObject({ failedCount: 2, flaggedForFollowUp: true, status: "Failed" });
    const flagged = await dailyTestService.flagged(fx.actor, { month: "2026-09" });
    expect(flagged.map((row) => row.fkStudentId)).toEqual([absent.id]);

    await dailyTestService.publish(fx.actor, tests[0].id);
    const parentUser = await Users.create({
      fkSchoolId: fx.school.id, firstName: "Par", lastName: "Ent", email: `par-${fx.school.id}@test.local`,
      password: "hashed-password", role: USER_ROLES.PARENT, status: "active",
    });
    const parent = await Parents.create({ fkSchoolId: fx.school.id, fkUserId: parentUser.id, fatherName: "Par Ent" });
    await StudentParents.create({ fkStudentId: absent.id, fkParentId: parent.id, relationshipType: "Father", isPrimary: true });
    const asParent = { id: parentUser.id, schoolId: fx.school.id, role: USER_ROLES.PARENT, email: parentUser.email };
    const seen = await dailyTestService.list(asParent, { studentId: absent.id, month: "2026-09" });
    expect(seen.map((t) => t.id)).toEqual([tests[0].id]);
    expect(seen[0].results[0].isAbsent).toBe(true);
    const [summary] = await dailyTestService.monthlySummary(asParent, { studentId: absent.id, month: "2026-09" });
    expect(summary.tests).toHaveLength(1);
    expect(summary.tests[0]).toMatchObject({ absent: true, passed: false });
    // One published test out of four scheduled: the month is still open.
    expect(summary.outcome).toMatchObject({ testsScheduled: 4, failedCount: 1, status: "InProgress" });
  });
});
