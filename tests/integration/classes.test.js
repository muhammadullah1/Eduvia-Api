"use strict";

const classService = require("../../services/class.service");
const studentService = require("../../services/student.service");
const { sequelize, Schools, AcademicSessions, Classes } = require("../../models");

async function buildFixture() {
  const stamp = Date.now();
  const school = await Schools.create({
    name: `Classes Test ${stamp}`,
    email: `classes-${stamp}@test.local`,
    code: `CL${stamp}`.slice(0, 20),
  });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  return { school, session, stamp };
}

describe("class service", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("list returns classes for school and optional session filter", async () => {
    const fx = await buildFixture();
    await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Nursery",
      section: "Main",
      label: "Nursery",
      room: "A-01",
      periodCount: 8,
      monthlyFee: 7500,
    });
    const all = await classService.list(fx.school.id);
    expect(all.length).toBeGreaterThanOrEqual(1);
    const filtered = await classService.list(fx.school.id, {
      sessionId: fx.session.id,
    });
    expect(filtered.every((row) => row.fkSessionId === fx.session.id)).toBe(
      true,
    );
  });

  test("create persists fkSessionId, grade, section, label, room, periodCount, monthlyFee", async () => {
    const fx = await buildFixture();
    const created = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Class 1",
      section: "Blue",
      label: "Class 1 · Blue",
      room: "B-12",
      periodCount: 9,
      monthlyFee: 8800,
    });
    expect(created.id).toBeTruthy();
    expect(created.fkSessionId).toBe(fx.session.id);
    expect(created.grade).toBe("Class 1");
    expect(created.section).toBe("Blue");
    expect(created.label).toBe("Class 1 · Blue");
    expect(created.room).toBe("B-12");
    expect(Number(created.periodCount)).toBe(9);
    expect(Number(created.monthlyTuitionFee)).toBe(8800);

    const row = await Classes.findByPk(created.id);
    expect(row).toBeTruthy();
    expect(row.fkSchoolId).toBe(fx.school.id);
    expect(Number(row.monthlyTuitionFee)).toBe(8800);
  });

  test("update patches fields", async () => {
    const fx = await buildFixture();
    const created = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Class 2",
      section: "A",
      label: "Class 2 · A",
      room: "C-01",
      periodCount: 8,
      monthlyFee: 8000,
    });
    const updated = await classService.update(created.id, fx.school.id, {
      room: "C-02",
      monthlyFee: 8200,
    });
    expect(updated.room).toBe("C-02");
    expect(Number(updated.monthlyTuitionFee)).toBe(8200);
  });

  test("remove soft-deletes class", async () => {
    const fx = await buildFixture();
    const created = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Class 3",
      section: "A",
      label: "Class 3 · A",
      room: "D-01",
      periodCount: 8,
      monthlyFee: 8000,
    });
    await classService.remove(created.id, fx.school.id);
    await expect(
      classService.getById(created.id, fx.school.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("active duplicate grade+section is rejected", async () => {
    const fx = await buildFixture();
    await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Grade",
      section: "Main",
      label: "Grade",
      room: "R1",
      periodCount: 8,
      monthlyFee: 1000,
    });
    await expect(
      classService.create(fx.school.id, {
        fkSessionId: fx.session.id,
        grade: "Grade",
        section: "Main",
        label: "Grade renamed",
        room: "R2",
        periodCount: 8,
        monthlyFee: 1000,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "A class with this name already exists in the current session.",
    });
  });

  test("recreate after archive is rejected and points to restore", async () => {
    const fx = await buildFixture();
    const first = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Grade 5",
      section: "A",
      label: "Grade 5 · A",
      room: "R1",
      periodCount: 8,
      monthlyFee: 1000,
    });
    await classService.remove(first.id, fx.school.id);
    const active = await classService.list(fx.school.id, {
      sessionId: fx.session.id,
    });
    expect(active.some((row) => row.id === first.id)).toBe(false);

    const archived = await classService.list(fx.school.id, {
      sessionId: fx.session.id,
      archived: true,
    });
    expect(archived.some((row) => row.id === first.id)).toBe(true);

    await expect(
      classService.create(fx.school.id, {
        fkSessionId: fx.session.id,
        grade: "Grade 5",
        section: "A",
        label: "Grade 5 · A",
        room: "R9",
        periodCount: 9,
        monthlyFee: 2000,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/archive/i),
    });

    const archivedAfter = await classService.list(fx.school.id, {
      sessionId: fx.session.id,
      archived: true,
    });
    expect(archivedAfter.some((row) => row.id === first.id)).toBe(true);
    const oldRow = archivedAfter.find((row) => row.id === first.id);
    expect(oldRow.room).toBe("R1");
  });

  test("explicit restore brings archived class back when no active duplicate", async () => {
    const fx = await buildFixture();
    const created = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id,
      grade: "Grade 6",
      section: "B",
      label: "Grade 6 · B",
      room: "X1",
      periodCount: 8,
      monthlyFee: 1000,
    });
    await classService.remove(created.id, fx.school.id);
    const restored = await classService.restore(created.id, fx.school.id);
    expect(restored.id).toBe(created.id);
    expect(restored.room).toBe("X1");
    const active = await classService.list(fx.school.id, {
      sessionId: fx.session.id,
    });
    expect(active.some((row) => row.id === created.id)).toBe(true);
  });

  test("a class starts inactive, can't be activated without students and can't be deleted with them", async () => {
    const fx = await buildFixture();
    const klass = await classService.create(fx.school.id, {
      fkSessionId: fx.session.id, grade: "Grade 4", section: "Rules", label: "Grade 4 · Rules", periodCount: 8, monthlyFee: 0,
    });
    expect(klass.status).toBe("Inactive");
    // Status is derived from enrolment, never set by hand.
    const unchanged = await classService.update(klass.id, fx.school.id, { status: "Active", room: "R1" });
    expect(unchanged.status).toBe("Inactive");

    await studentService.create(fx.school.id, {
      fkClassId: klass.id, admissionNo: `R-${fx.stamp}`.slice(0, 20),
      firstName: "Sara", lastName: "Ali", gender: "Female", dateOfBirth: "2018-01-01", admissionDate: "2026-04-01", status: "Active",
    });
    expect((await Classes.findByPk(klass.id)).status).toBe("Active");
    await expect(classService.remove(klass.id, fx.school.id)).rejects.toMatchObject({
      statusCode: 409,
      message: "Grade 4 · Rules has 1 enrolled student. Move or withdraw them before deleting the class.",
    });
    expect(await Classes.findByPk(klass.id)).not.toBeNull();
  });
});
