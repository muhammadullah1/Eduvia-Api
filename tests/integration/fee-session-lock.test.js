"use strict";

/**
 * Session fee lock + bootstrap: once session.start_date <= today, structure
 * mutations are refused except one initial setup per fee type with no live row.
 */
const app = require("../../app");
const { sequelize, AcademicSessions, FeeStructures } = require("../../models");
const { makeSchool, makeUser, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");
const classService = require("../../services/class.service");
const { today } = require("../../utils/dates");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("fee structure session lock", () => {
  let school; let lockedSession; let futureSession; let lockedClass; let futureClass; let tok; let admin;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school } = await makeSchool());
    admin = await makeUser(school.id, "super_admin");
    tok = tokenFor(admin);

    lockedSession = await AcademicSessions.create({
      fkSchoolId: school.id,
      name: `Locked-${Date.now()}`,
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isCurrent: false,
    });
    futureSession = await AcademicSessions.create({
      fkSchoolId: school.id,
      name: `Future-${Date.now()}`,
      startDate: "2099-04-01",
      endDate: "2100-03-31",
      isCurrent: false,
    });
    lockedClass = await classService.create(school.id, {
      fkSessionId: lockedSession.id,
      grade: "Lock",
      section: "A",
      label: "Lock A",
      monthlyTuitionFee: 1000,
      capacity: 30,
    });
    futureClass = await classService.create(school.id, {
      fkSessionId: futureSession.id,
      grade: "Fut",
      section: "A",
      label: "Fut A",
      monthlyTuitionFee: 2000,
      capacity: 30,
    });
  });

  afterAll(() => sequelize.close());

  test("GET reports sessionLocked for a started session", async () => {
    expect(today() >= "2026-04-01").toBe(true);
    const res = await call(tok, "GET", `/fee-structures/classes/${lockedClass.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sessionLocked).toBe(true);
    expect(res.body.data.bootstrapEligible).toEqual(expect.arrayContaining(["Admission", "Exam", "Annual"]));
    expect(res.body.data.bootstrapEligible).not.toContain("Tuition");
  });

  test("changing Tuition on a locked session with a live row is refused", async () => {
    const res = await call(tok, "POST", `/fee-structures/classes/${lockedClass.id}`, { feeType: "Tuition", amount: 9999 });
    expect(res.status).toBe(409);
    expect(res.body.data?.code || res.body?.code || JSON.stringify(res.body)).toMatch(/FEE_STRUCTURE_SESSION_LOCKED|locked/i);
  });

  test("bootstrap allows one initial Exam on a locked session, then locks it", async () => {
    const first = await call(tok, "POST", `/fee-structures/classes/${lockedClass.id}`, { feeType: "Exam", amount: 800 });
    expect(first.status).toBe(201);
    expect(first.body.data.effectiveFrom).toBe("2026-04-01");
    const second = await call(tok, "POST", `/fee-structures/classes/${lockedClass.id}`, { feeType: "Exam", amount: 900 });
    expect(second.status).toBe(409);
  });

  test("remove is refused while the session is locked", async () => {
    const res = await call(tok, "DELETE", `/fee-structures/classes/${lockedClass.id}/Exam`, { reason: "trying to unlock" });
    expect(res.status).toBe(409);
  });

  test("future sessions remain editable and supersede to a single live row", async () => {
    const get = await call(tok, "GET", `/fee-structures/classes/${futureClass.id}`);
    expect(get.body.data.sessionLocked).toBe(false);
    const change = await call(tok, "POST", `/fee-structures/classes/${futureClass.id}`, { feeType: "Tuition", amount: 2500 });
    expect(change.status).toBe(201);
    expect(change.body.data.amount).toBe(2500);
    expect(change.body.data.effectiveFrom).toBe("2099-04-01");
    const live = await FeeStructures.findAll({ where: { fkClassId: futureClass.id, feeType: "Tuition" } });
    expect(live).toHaveLength(1);
    expect(Number(live[0].amount)).toBe(2500);
  });

  test("class form cannot change tuition after lock when a row exists", async () => {
    const res = await call(tok, "PATCH", `/classes/${lockedClass.id}`, { monthlyFee: 3333 });
    expect([400, 409]).toContain(res.status);
  });
});
