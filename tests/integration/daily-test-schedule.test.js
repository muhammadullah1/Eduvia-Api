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
});
