"use strict";

const { Op } = require("sequelize");
const {
  Parents,
  StudentParents,
  Students,
  Teachers,
  TeacherClasses,
  TimetableSlots,
  SubstituteAssignments,
} = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");

/**
 * Row-level scoping (BR-14, §12/§16). Route guards decide *which* endpoints a
 * role may call; these helpers decide *which rows* it may see or touch.
 */

async function linkedStudentIds(user) {
  const parent = await Parents.findOne({ where: { fkUserId: user.id, fkSchoolId: user.schoolId } });
  if (!parent) return [];
  const links = await StudentParents.findAll({ where: { fkParentId: parent.id }, attributes: ["fkStudentId"] });
  return links.map((l) => l.fkStudentId);
}

/** Students a parent may read; null means "not restricted" for staff. */
async function studentScope(user) {
  return user.role === USER_ROLES.PARENT ? linkedStudentIds(user) : null;
}

async function assertStudentAccess(user, studentId) {
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: user.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  if (user.role === USER_ROLES.PARENT) {
    const ids = await linkedStudentIds(user);
    if (!ids.includes(student.id)) throw new ApiError(403, "This student is not linked to your account.");
  }
  return student;
}

/** Classes a parent's linked children are in. */
async function linkedClassIds(user) {
  const ids = await linkedStudentIds(user);
  if (!ids.length) return [];
  const students = await Students.findAll({ where: { id: ids }, attributes: ["fkClassId"] });
  return [...new Set(students.map((s) => s.fkClassId).filter(Boolean))];
}

async function assertClassVisible(user, classId) {
  if (user.role !== USER_ROLES.PARENT) return;
  const classes = await linkedClassIds(user);
  if (!classes.includes(Number(classId))) throw new ApiError(403, "This class is not linked to your account.");
}

async function teacherFor(user) {
  const teacher = await Teachers.findOne({ where: { fkUserId: user.id, fkSchoolId: user.schoolId } });
  if (!teacher) throw new ApiError(403, "No teacher profile for this account.");
  return teacher;
}

/** Classes a teacher regularly teaches (assignment + timetable). */
async function teacherClassIds(teacher) {
  const [assigned, slots] = await Promise.all([
    TeacherClasses.findAll({ where: { fkTeacherId: teacher.id }, attributes: ["fkClassId"] }),
    TimetableSlots.findAll({ where: { fkTeacherId: teacher.id }, attributes: ["fkClassId"] }),
  ]);
  return [...new Set([...assigned, ...slots].map((r) => r.fkClassId))];
}

/**
 * A teacher may record academic work for a class+subject when it is their
 * active subject in one of their classes, or when they were assigned as the
 * substitute for that class on that date.
 */
async function assertTeacherCanTeach(user, { classId, subjectId, date }) {
  if (user.role !== USER_ROLES.TEACHER) return null;
  const teacher = await teacherFor(user);
  const classIds = await teacherClassIds(teacher);
  if (classIds.includes(Number(classId)) && Number(subjectId) === teacher.fkSubjectId) return teacher;
  if (date) {
    const cover = await SubstituteAssignments.findOne({
      where: { fkSubstituteTeacherId: teacher.id, fkClassId: classId, date, fkSubjectId: { [Op.or]: [subjectId, null] } },
    });
    if (cover) return teacher;
  }
  throw new ApiError(403, "You can only record work for your own subject and classes.");
}

/** Teachers work with their own classes, or a class they cover on `date`. */
async function assertTeacherClass(user, classId, date) {
  if (user.role !== USER_ROLES.TEACHER) return;
  const teacher = await teacherFor(user);
  if ((await teacherClassIds(teacher)).includes(Number(classId))) return;
  if (date && (await SubstituteAssignments.findOne({ where: { fkSubstituteTeacherId: teacher.id, fkClassId: classId, date } }))) return;
  throw new ApiError(403, "You can only work with your own classes.");
}

module.exports = {
  assertTeacherClass,
  linkedStudentIds,
  studentScope,
  assertStudentAccess,
  linkedClassIds,
  assertClassVisible,
  teacherFor,
  teacherClassIds,
  assertTeacherCanTeach,
};
