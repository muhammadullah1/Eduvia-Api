"use strict";

const { QueryTypes } = require("sequelize");
const app = require("../../app");
const { sequelize, StudentFeeMonths, SchoolConcessionReasons } = require("../../models");
const { actorFor, makeSchool, makeUser, tokenFor, makeStudent } = require("../helpers/school");
const { request } = require("../helpers/http");
const classService = require("../../services/class.service");
const settingsService = require("../../services/settings.service");
const { SETTING_KEYS } = require("../../constants");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });

/** An unverified family holding the given students. */
async function makeFamily(schoolId, studentIds) {
  const [family] = await sequelize.query(
    "INSERT INTO families (fk_school_id, display_name) VALUES (:schoolId, 'Test family') RETURNING id",
    { replacements: { schoolId }, type: QueryTypes.SELECT },
  );
  for (const studentId of studentIds) {
    await sequelize.query(
      "INSERT INTO family_members (fk_family_id, fk_student_id) VALUES (:familyId, :studentId)",
      { replacements: { familyId: family.id, studentId } },
    );
  }
  return family.id;
}

describe("fee concession rules", () => {
  let school; let session; let klass; let tok; let siblingId;

  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    const admin = await makeUser(school.id, "super_admin");
    tok = { admin: tokenFor(admin), acc: tokenFor(await makeUser(school.id, "accountant")) };
    klass = await classService.create(school.id, {
      fkSessionId: session.id, grade: "R", section: "1", label: "R1", monthlyFee: 1000, capacity: 40,
    });
    const sibling = await SchoolConcessionReasons.create({
      fkSchoolId: school.id, label: "Sibling", defaultMode: "percent", defaultValue: 10,
      sortOrder: 10, active: true, requiresFamily: true,
    });
    siblingId = sibling.id;
    await settingsService.update(await actorFor(admin), SETTING_KEYS.FEES, {
      concessionPolicy: {
        allowedModes: ["percent", "fixed_discount", "fixed_payable", "waiver"],
        approvalRule: "threshold",
        approvalPercentAbove: 15,
        approvalAmountAbove: 200,
      },
    });
  });

  afterAll(() => sequelize.close());

  test("fixed payable always needs approval and bills the payable amount", async () => {
    const student = await makeStudent(school.id, klass.id);
    const res = await call(tok.acc, "POST", "/fee-concessions", {
      studentId: student.id, reasonLabel: "Hardship case", mode: "fixed_payable", value: 600,
      feeType: "Tuition", effectiveFrom: "2026-04-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PendingApproval");
    expect((await call(tok.admin, "POST", `/fee-concessions/${res.body.data.id}/approve`)).status).toBe(200);
    await call(tok.admin, "POST", "/fees/months/generate", { month: "2026-09", classId: klass.id });
    const bill = await StudentFeeMonths.findOne({ where: { fkStudentId: student.id, month: "2026-09", feeType: "Tuition" } });
    expect(Number(bill.baseAmount)).toBe(1000);
    expect(Number(bill.netAmount)).toBe(600);
    expect(bill.concessionSnapshot.mode).toBe("fixed_payable");
  });

  test("a fixed discount of zero is rejected", async () => {
    const student = await makeStudent(school.id, klass.id);
    const res = await call(tok.admin, "POST", "/fee-concessions", {
      studentId: student.id, reasonLabel: "Other", mode: "fixed_discount", value: 0,
      feeType: "Tuition", effectiveFrom: "2026-04-01",
    });
    expect(res.status).toBe(400);
  });

  test("a zero percent concession is rejected", async () => {
    const student = await makeStudent(school.id, klass.id);
    const res = await call(tok.admin, "POST", "/fee-concessions", {
      studentId: student.id, reasonLabel: "Other", mode: "percent", value: 0,
      feeType: "Tuition", effectiveFrom: "2026-04-01",
    });
    expect(res.status).toBe(400);
  });

  test("a sibling concession needs a verified family with another active student", async () => {
    const student = await makeStudent(school.id, klass.id);
    const brother = await makeStudent(school.id, klass.id);
    const body = { studentId: student.id, reasonId: siblingId, mode: "percent", value: 10, feeType: "Tuition", effectiveFrom: "2026-04-01" };

    expect((await call(tok.admin, "POST", "/fee-concessions", body)).status).toBe(409);
    const typed = await call(tok.admin, "POST", "/fee-concessions", { ...body, reasonId: undefined, reasonLabel: "sibling" });
    expect(typed.status).toBe(409);

    const familyId = await makeFamily(school.id, [student.id, brother.id]);
    expect((await call(tok.admin, "POST", "/fee-concessions", body)).status).toBe(409);

    await sequelize.query("UPDATE families SET verified_at = now() WHERE id = :familyId", { replacements: { familyId } });
    const ok = await call(tok.admin, "POST", "/fee-concessions", body);
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe("Approved");
  });

  test("other fee types do not conflict with tuition", async () => {
    const student = await makeStudent(school.id, klass.id);
    const base = { studentId: student.id, reasonLabel: "Merit", mode: "percent", value: 10, effectiveFrom: "2026-04-01" };
    expect((await call(tok.admin, "POST", "/fee-concessions", { ...base, feeType: "Tuition" })).status).toBe(201);
    expect((await call(tok.admin, "POST", "/fee-concessions", { ...base, feeType: "Admission" })).status).toBe(201);
  });
});
