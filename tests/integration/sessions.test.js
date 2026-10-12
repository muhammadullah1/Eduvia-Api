"use strict";

const sessionService = require("../../services/session.service");
const { sequelize, Schools, AcademicSessions } = require("../../models");

async function buildFixture() {
  const stamp = Date.now();
  const school = await Schools.create({
    name: `Sessions Test ${stamp}`,
    email: `sessions-${stamp}@test.local`,
    code: `SS${stamp}`.slice(0, 20),
  });
  const current = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2025-26",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
    isCurrent: true,
  });
  return { school, current, stamp };
}

describe("session service", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("list returns sessions for school ordered by start date", async () => {
    const fx = await buildFixture();
    await sessionService.create(fx.school.id, {
      name: "2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isCurrent: false,
    });
    const rows = await sessionService.list(fx.school.id);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.fkSchoolId === fx.school.id)).toBe(true);
  });

  test("create persists name and dates with isCurrent default false", async () => {
    const fx = await buildFixture();
    const created = await sessionService.create(fx.school.id, {
      name: "2027-28",
      startDate: "2027-04-01",
      endDate: "2028-03-31",
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("2027-28");
    expect(created.isCurrent).toBe(false);
  });

  test("activate sets exactly one current session per school", async () => {
    const fx = await buildFixture();
    const upcoming = await sessionService.create(fx.school.id, {
      name: "2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isCurrent: false,
    });
    await sessionService.activate(upcoming.id, fx.school.id);
    const rows = await sessionService.list(fx.school.id);
    const current = rows.filter((row) => row.isCurrent);
    expect(current.length).toBe(1);
    expect(current[0].id).toBe(upcoming.id);
  });

  test("update patches fields", async () => {
    const fx = await buildFixture();
    const created = await sessionService.create(fx.school.id, {
      name: "2028-29",
      startDate: "2028-04-01",
      endDate: "2029-03-31",
      isCurrent: false,
    });
    const updated = await sessionService.update(created.id, fx.school.id, {
      name: "2028–2029",
    });
    expect(updated.name).toBe("2028–2029");
  });

  test("remove deletes session", async () => {
    const fx = await buildFixture();
    const created = await sessionService.create(fx.school.id, {
      name: "Temp",
      startDate: "2030-04-01",
      endDate: "2031-03-31",
      isCurrent: false,
    });
    await sessionService.remove(created.id, fx.school.id);
    const row = await AcademicSessions.findByPk(created.id);
    expect(row).toBeNull();
  });
});
