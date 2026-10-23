"use strict";

const { Schools, AcademicSessions, Users, Classes, Students, Parents, StudentParents } = require("../../models");
const { generateToken } = require("../../utils");

let counter = 0;
const uid = () => `${Date.now()}${(counter += 1)}`;

async function makeSchool() {
  const stamp = uid();
  const school = await Schools.create({ name: `School ${stamp}`, email: `s-${stamp}@test.local`, code: `S${stamp}`.slice(0, 20) });
  const session = await AcademicSessions.create({
    fkSchoolId: school.id,
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
  });
  return { school, session };
}

async function makeUser(schoolId, role) {
  const stamp = uid();
  return Users.create({
    fkSchoolId: schoolId,
    firstName: "Test",
    lastName: role,
    email: `${role}-${stamp}@test.local`,
    password: "hashed",
    role,
    status: "active",
  });
}

const tokenFor = (user, expiresIn = "15m") =>
  generateToken({ id: user.id, schoolId: user.fkSchoolId, role: user.role, email: user.email }, expiresIn);

async function makeClass(schoolId, sessionId, label = `Class ${uid()}`) {
  return Classes.create({ fkSchoolId: schoolId, fkSessionId: sessionId, grade: label, section: "A", label, monthlyTuitionFee: 1000, capacity: 30 });
}

async function makeStudent(schoolId, classId, extra = {}) {
  return Students.create({
    fkSchoolId: schoolId,
    fkClassId: classId,
    admissionNo: `A${uid()}`.slice(0, 20),
    firstName: "Kid",
    lastName: "Test",
    gender: "Male",
    dateOfBirth: "2018-01-01",
    admissionDate: "2026-04-01",
    status: "Active",
    ...extra,
  });
}

/** A parent user linked to `studentId`. */
async function makeParent(schoolId, studentId) {
  const user = await makeUser(schoolId, "parent");
  const parent = await Parents.create({ fkUserId: user.id, fkSchoolId: schoolId, guardianName: "Guardian" });
  if (studentId) await StudentParents.create({ fkParentId: parent.id, fkStudentId: studentId, isPrimary: true, relationshipType: "Father" });
  return user;
}

module.exports = { makeSchool, makeUser, tokenFor, makeClass, makeStudent, makeParent, uid };
