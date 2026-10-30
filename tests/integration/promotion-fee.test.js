"use strict";

/**
 * Promotion OneTime fee: billed once on promote / bulk-promote from the target
 * class Fee Structure. Skips when missing or amount ≤ 0. Never rewrites bills.
 */
const app = require("../../app");
const { sequelize, FeeStructures, StudentFeeMonths } = require("../../models");
const { makeSchool, makeUser, tokenFor, makeClass, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

describe("promotion fee billing", () => {
  let school; let session; let tok; let from; let to;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    const admin = await makeUser(school.id, "super_admin");
    tok = tokenFor(admin);
    from = await makeClass(school.id, session.id, "Promo From");
    to = await makeClass(school.id, session.id, "Promo To");
    await FeeStructures.create({
      fkSchoolId: school.id,
      fkSessionId: session.id,
      fkClassId: to.id,
      feeType: "Promotion",
      frequency: "OneTime",
      amount: 2500,
      effectiveFrom: "2026-04-01",
    });
  });

  afterAll(() => sequelize.close());

  test("single promote bills Promotion once for the target class", async () => {
    const student = await makeStudent(school.id, from.id);
    const res = await call(tok, "POST", `/students/${student.id}/promote`, {
      classId: to.id,
      sessionId: session.id,
      date: "2026-10-15",
    });
    expect(res.status).toBe(200);

    const bills = await StudentFeeMonths.findAll({
      where: { fkStudentId: student.id, feeType: "Promotion" },
    });
    expect(bills).toHaveLength(1);
    expect(Number(bills[0].baseAmount)).toBe(2500);
    expect(bills[0].month).toBe("2026-10");

    const other = await makeClass(school.id, session.id, "Promo Other");
    await FeeStructures.create({
      fkSchoolId: school.id,
      fkSessionId: session.id,
      fkClassId: other.id,
      feeType: "Promotion",
      frequency: "OneTime",
      amount: 3000,
      effectiveFrom: "2026-04-01",
    });
    const again = await call(tok, "POST", `/students/${student.id}/promote`, {
      classId: other.id,
      sessionId: session.id,
      date: "2026-10-20",
    });
    expect(again.status).toBe(200);
    expect(
      await StudentFeeMonths.count({
        where: { fkStudentId: student.id, feeType: "Promotion", month: "2026-10" },
      }),
    ).toBe(1);
    expect(Number(bills[0].baseAmount)).toBe(2500);
  });

  test("promote skips billing when Promotion amount is 0 or missing", async () => {
    const bare = await makeClass(school.id, session.id, "No Promo Fee");
    const student = await makeStudent(school.id, from.id);
    const res = await call(tok, "POST", `/students/${student.id}/promote`, {
      classId: bare.id,
      sessionId: session.id,
      date: "2026-10-05",
    });
    expect(res.status).toBe(200);
    expect(
      await StudentFeeMonths.count({
        where: { fkStudentId: student.id, feeType: "Promotion" },
      }),
    ).toBe(0);
  });

  test("bulk promote bills Promotion for promote actions only", async () => {
    const a = await makeStudent(school.id, from.id);
    const b = await makeStudent(school.id, from.id);
    const res = await call(tok, "POST", "/students/promotions/bulk", {
      fromClassId: from.id,
      toClassId: to.id,
      sessionId: session.id,
      date: "2026-10-08",
      students: [
        { studentId: a.id, action: "promote" },
        { studentId: b.id, action: "hold" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.promoted).toBe(1);
    expect(res.body.data.repeated).toBe(1);

    expect(
      await StudentFeeMonths.count({
        where: { fkStudentId: a.id, feeType: "Promotion", month: "2026-10" },
      }),
    ).toBe(1);
    expect(
      await StudentFeeMonths.count({
        where: { fkStudentId: b.id, feeType: "Promotion" },
      }),
    ).toBe(0);
  });
});
