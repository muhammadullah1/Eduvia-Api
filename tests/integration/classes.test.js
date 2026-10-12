"use strict";

const classService = require("../../services/class.service");
const { sequelize, Schools, AcademicSessions, Classes } = require("../../models");
const { USER_ROLES } = require("../../constants");

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
});
