"use strict";

const applicationService = require("../../services/application.service");
const { serializeApplication } = require("../../utils/applicationSerializer");
const { sequelize, Schools, AcademicSessions, Users, Classes } = require("../../models");
const { USER_ROLES } = require("../../constants");
const ApiError = require("../../utils/ApiError");

async function buildFixture() {
  const stamp = Date.now();
  const school = await Schools.create({
    name: `Admissions Test ${stamp}`,
    email: `school-${stamp}@test.local`,
    code: `AD${stamp}`.slice(0, 20),
  });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  const admin = await Users.create({
    fkSchoolId: school.id,
    firstName: "Admin",
    lastName: "User",
    email: `admin-${stamp}@test.local`,
    phone: "03001111111",
    password: "hashed",
    role: USER_ROLES.SUPER_ADMIN,
    status: "active",
  });
  const klass = await Classes.create({
    fkSchoolId: school.id,
    fkSessionId: session.id,
    label: "Grade 1 · A",
    grade: "1",
    section: "A",
    monthlyTuitionFee: 1000,
    capacity: 30,
  });
  return { school, session, admin, klass, stamp };
}

describe("application service", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  test("draft → patch steps → submit → decide admit → enroll", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "Hassan Ali",
      fkClassId: fx.klass.id,
    });
    expect(draft.submittedOn).toBeNull();
    expect(draft.documents.length).toBeGreaterThan(0);

    await applicationService.update(draft.id, fx.school.id, {
      guardian: "Fatima Ali",
      phone: "03001234567",
      email: `parent-${fx.stamp}@test.local`,
      dob: "2016-03-10",
      gender: "Male",
      address: "12 Test Street",
      interviewType: "Interview",
      interviewResult: "Pass",
      documents: draft.documents.map((d) => ({
        id: d.id,
        label: d.label,
        status: "Uploaded",
      })),
    });

    const submitted = await applicationService.submit(draft.id, fx.school.id);
    expect(submitted.submittedOn).toBeTruthy();

    await applicationService.decide(draft.id, fx.school.id, "Admit", "Recommended");
    const enrolled = await applicationService.enroll(
      draft.id,
      fx.school.id,
      {},
      { id: fx.admin.id, schoolId: fx.school.id, role: fx.admin.role },
    );
    expect(enrolled.application.status).toBe("Enrolled");
    expect(enrolled.student).toBeTruthy();
  });

  test("cannot decide before submit", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "Pending Student",
      fkClassId: fx.klass.id,
    });
    await expect(
      applicationService.decide(draft.id, fx.school.id, "Reject"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("createDraft accepts wizard payload with interview and notes fields", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "Wizard Applicant",
      fkClassId: fx.klass.id,
      guardian: "",
      phone: "030078678767",
      email: `wizard-${fx.stamp}@test.local`,
      dob: "2020-01-01",
      gender: "Male",
      address: "Test address",
      interviewType: "Interview",
      interviewDate: null,
      interviewScore: "",
      interviewResult: "",
      notes: "",
      documents: [{ label: "Birth Certificate / B-Form", status: "Pending" }],
    });
    expect(draft.id).toBeTruthy();
    expect(draft.documents.length).toBeGreaterThan(0);
  });

  test("list defaults to page 1 and pageSize 10", async () => {
    const fx = await buildFixture();
    for (let i = 0; i < 12; i += 1) {
      await applicationService.createDraft(fx.school.id, {
        name: `Paged Applicant ${i}`,
        fkClassId: fx.klass.id,
      });
    }
    const page1 = await applicationService.list(fx.school.id, { page: 1 });
    expect(page1.pageSize).toBe(10);
    expect(page1.rows.length).toBe(10);
    expect(page1.count).toBeGreaterThanOrEqual(12);
    const page2 = await applicationService.list(fx.school.id, { page: 2 });
    expect(page2.rows.length).toBeGreaterThanOrEqual(2);
  });

  test("list supports search and tenant isolation", async () => {
    const fx = await buildFixture();
    const other = await buildFixture();
    await applicationService.create(fx.school.id, {
      name: "Unique Search Name",
      fkClassId: fx.klass.id,
      guardian: "Guardian",
      phone: "03009998877",
      email: `g-${fx.stamp}@test.local`,
      dob: "2015-01-01",
      gender: "Female",
    });
    const mine = await applicationService.list(fx.school.id, { q: "Unique Search" });
    expect(mine.rows.some((r) => r.name.includes("Unique Search"))).toBe(true);
    const theirs = await applicationService.list(other.school.id, { q: "Unique Search" });
    expect(theirs.rows).toHaveLength(0);
  });

  test("cannot patch status directly", async () => {
    const fx = await buildFixture();
    const app = await applicationService.create(fx.school.id, {
      name: "Status Patch",
      fkClassId: fx.klass.id,
      guardian: "G",
      phone: "03001230000",
      email: `s-${fx.stamp}@test.local`,
      dob: "2014-01-01",
      gender: "Male",
    });
    await expect(
      applicationService.update(app.id, fx.school.id, { status: "Rejected" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("mark under review requires submission", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "Review Me",
      fkClassId: fx.klass.id,
    });
    await expect(
      applicationService.markUnderReview(draft.id, fx.school.id),
    ).rejects.toBeInstanceOf(ApiError);
  });

  test("serializer exposes stable API field names", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "API Shape",
      fkClassId: fx.klass.id,
      guardian: "Parent",
      phone: "03001112222",
    });
    const dto = serializeApplication(draft);
    expect(dto.id).toBe(draft.id);
    expect(dto.name).toContain("API");
    expect(dto.guardian).toBe("Parent");
    expect(dto.phone).toBe("03001112222");
    expect(Array.isArray(dto.documents)).toBe(true);
  });

  test("submit rejects incomplete draft", async () => {
    const fx = await buildFixture();
    const draft = await applicationService.createDraft(fx.school.id, {
      name: "Incomplete",
      fkClassId: fx.klass.id,
    });
    await expect(
      applicationService.submit(draft.id, fx.school.id),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
