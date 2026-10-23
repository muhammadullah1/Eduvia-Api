"use strict";

const { sequelize, Classes } = require("../../models");
const studentService = require("../../services/student.service");
const applicationService = require("../../services/application.service");
const { makeSchool, makeUser, makeClass, makeStudent } = require("../helpers/school");

const statusOf = async (klass) => (await Classes.findByPk(klass.id)).status;
const actorFor = (user) => ({ id: user.id, schoolId: user.fkSchoolId, role: user.role });

describe("class status follows enrolment", () => {
  let school;
  let session;
  let actor;
  beforeAll(async () => {
    await sequelize.authenticate();
    ({ school, session } = await makeSchool());
    actor = actorFor(await makeUser(school.id, "super_admin"));
  });

  const emptyClass = async () => {
    const klass = await makeClass(school.id, session.id);
    await klass.update({ status: "Inactive" });
    return klass;
  };

  test("create and delete a (pending) student", async () => {
    const klass = await emptyClass();
    const student = await studentService.create(school.id, {
      fkClassId: klass.id, admissionNo: `C${Date.now()}`.slice(0, 20), firstName: "A", lastName: "B",
      gender: "Male", dateOfBirth: "2018-01-01", admissionDate: "2026-04-01", status: "Pending",
    });
    expect(await statusOf(klass)).toBe("Active");
    await studentService.remove(student.id, school.id);
    expect(await statusOf(klass)).toBe("Inactive");
  });

  test("transfer moves Active from the old class to the new one", async () => {
    const from = await emptyClass();
    const to = await emptyClass();
    const student = await makeStudent(school.id, from.id);
    await from.update({ status: "Active" });
    await studentService.update(student.id, school.id, { fkClassId: to.id });
    expect(await statusOf(from)).toBe("Inactive");
    expect(await statusOf(to)).toBe("Active");
  });

  test("strike-off and graduation leave; readmission comes back", async () => {
    const klass = await emptyClass();
    const student = await makeStudent(school.id, klass.id);
    await klass.update({ status: "Active" });
    await studentService.changeStatus(actor, student.id, {
      status: "StruckOff", reason: "Moved", reasonCategory: "Withdrawn by parent", academicStatus: "Passed Grade", effectiveOn: "2026-10-01",
    });
    expect(await statusOf(klass)).toBe("Inactive");
    await studentService.changeStatus(actor, student.id, {
      status: "Active", reason: "Back", effectiveOn: "2026-10-02", classId: klass.id, sessionId: session.id,
    });
    expect(await statusOf(klass)).toBe("Active");
    await studentService.changeStatus(actor, student.id, {
      status: "Graduated", reason: "Done", effectiveOn: "2026-10-03", finalResult: "Pass", graduationOverride: true,
    });
    expect(await statusOf(klass)).toBe("Inactive");
  });

  test("temporarily Inactive students still keep the class Active", async () => {
    const klass = await emptyClass();
    const student = await makeStudent(school.id, klass.id);
    await studentService.changeStatus(actor, student.id, { status: "Inactive", reason: "Travel", reasonCategory: "Leave", effectiveOn: "2026-10-01" });
    expect(await statusOf(klass)).toBe("Active");
  });

  test("promote empties the old class and fills the new one", async () => {
    const from = await emptyClass();
    const to = await emptyClass();
    const student = await makeStudent(school.id, from.id);
    await from.update({ status: "Active" });
    await studentService.promote(actor, student.id, { classId: to.id, sessionId: session.id, date: "2026-10-05" });
    expect(await statusOf(from)).toBe("Inactive");
    expect(await statusOf(to)).toBe("Active");
  });

  test("bulk promote (concurrent per-student calls) empties the old class", async () => {
    const from = await emptyClass();
    const to = await emptyClass();
    const kids = await Promise.all([makeStudent(school.id, from.id), makeStudent(school.id, from.id), makeStudent(school.id, from.id)]);
    await from.update({ status: "Active" });
    await Promise.all(kids.map((kid) => studentService.promote(actor, kid.id, { classId: to.id, sessionId: session.id, date: "2026-10-05" })));
    expect(await statusOf(from)).toBe("Inactive");
    expect(await statusOf(to)).toBe("Active");
  });

  test("graduating or striking off all but one keeps Active; the last one leaving makes it Inactive", async () => {
    const klass = await emptyClass();
    const [a, b] = [await makeStudent(school.id, klass.id), await makeStudent(school.id, klass.id)];
    await klass.update({ status: "Active" });
    await studentService.changeStatus(actor, a.id, {
      status: "Graduated", reason: "Done", effectiveOn: "2026-10-03", finalResult: "Pass", graduationOverride: true,
    });
    expect(await statusOf(klass)).toBe("Active");
    await studentService.changeStatus(actor, b.id, {
      status: "StruckOff", reason: "Moved", reasonCategory: "Transfer out", academicStatus: "Mid-year", effectiveOn: "2026-10-03",
    });
    expect(await statusOf(klass)).toBe("Inactive");
    // Readmitting the struck-off student brings the class back.
    await studentService.changeStatus(actor, b.id, {
      status: "Active", reason: "Re-admitted", effectiveOn: "2026-10-10", classId: klass.id, sessionId: session.id,
    });
    expect(await statusOf(klass)).toBe("Active");
  });

  test("deleting the last student (concurrently with another) leaves the class Inactive", async () => {
    const klass = await emptyClass();
    const kids = [await makeStudent(school.id, klass.id, { status: "Pending" }), await makeStudent(school.id, klass.id, { status: "Pending" })];
    await klass.update({ status: "Active" });
    await Promise.all(kids.map((kid) => studentService.remove(kid.id, school.id)));
    expect(await statusOf(klass)).toBe("Inactive");
  });

  test("archived classes are never reactivated by student moves", async () => {
    const klass = await emptyClass();
    await klass.update({ status: "Archived" });
    const { syncClassStatus } = require("../../services/class.service");
    await makeStudent(school.id, klass.id);
    await syncClassStatus(klass.id);
    expect(await statusOf(klass)).toBe("Archived");
  });

  test("enrolling an admitted application activates the class", async () => {
    const klass = await emptyClass();
    const app = await applicationService.createDraft(school.id, { name: "New Kid", fkClassId: klass.id });
    await applicationService.update(app.id, school.id, {
      guardian: "Imran Noor", guardianRelation: "Father", phone: "03007654321",
      dob: "2019-03-10", gender: "Female", address: "7 Mall Road",
      documents: app.documents.map((d) => ({ id: d.id, label: d.label, status: "Uploaded" })),
    });
    await applicationService.submit(app.id, school.id);
    await applicationService.decide(app.id, school.id, "Admit", "Recommended");
    await applicationService.enroll(app.id, school.id, {}, actor);
    expect(await statusOf(klass)).toBe("Active");
  });
});
