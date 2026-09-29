"use strict";

const {
  Teachers,
  Users,
  Subjects,
  Classes,
  TeacherSubjects,
  TeacherClasses,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId) {
  return Teachers.findAll({
    where: { fkSchoolId: schoolId },
    include: [
      { model: Users, as: "user", attributes: { exclude: ["password"] } },
      { model: Subjects, as: "primarySubject" },
      { model: Subjects, as: "subjects", through: { attributes: [] } },
      { model: Classes, as: "classes", through: { attributes: [] } },
    ],
    order: [["id", "ASC"]],
  });
}

async function getById(id, schoolId) {
  const row = await Teachers.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [
      { model: Users, as: "user", attributes: { exclude: ["password"] } },
      { model: Subjects, as: "primarySubject" },
      { model: Subjects, as: "subjects", through: { attributes: [] } },
      { model: Classes, as: "classes", through: { attributes: [] } },
    ],
  });
  if (!row) throw new ApiError(404, "Teacher not found");
  return row;
}

/**
 * Prefer one-teacher-one-subject. Still editable:
 * - primarySubjectId sets the canonical subject
 * - subjectIds (optional) syncs the join table; defaults to [primarySubjectId]
 */
async function assignSubjects(teacherId, schoolId, { subjectIds, primarySubjectId } = {}) {
  const teacher = await getById(teacherId, schoolId);
  let ids = Array.isArray(subjectIds) ? subjectIds.filter(Boolean) : [];
  const primary = primarySubjectId ?? ids[0] ?? null;

  if (primary != null && !ids.includes(primary)) {
    ids = [primary, ...ids];
  }
  // Default policy: keep a single subject when only primary is provided
  if (primary != null && (!subjectIds || subjectIds.length === 0)) {
    ids = [primary];
  }

  return sequelize.transaction(async (t) => {
    await teacher.update({ fkPrimarySubjectId: primary }, { transaction: t });
    await TeacherSubjects.destroy({ where: { fkTeacherId: teacher.id }, transaction: t });
    if (ids.length) {
      await TeacherSubjects.bulkCreate(
        ids.map((fkSubjectId) => ({ fkTeacherId: teacher.id, fkSubjectId })),
        { transaction: t },
      );
    }
    return getById(teacherId, schoolId);
  });
}

async function assignPrimarySubject(teacherId, schoolId, primarySubjectId) {
  return assignSubjects(teacherId, schoolId, {
    primarySubjectId,
    subjectIds: primarySubjectId ? [primarySubjectId] : [],
  });
}

async function assignClasses(teacherId, schoolId, classIds = []) {
  const teacher = await getById(teacherId, schoolId);
  return sequelize.transaction(async (t) => {
    await TeacherClasses.destroy({ where: { fkTeacherId: teacher.id }, transaction: t });
    if (classIds.length) {
      await TeacherClasses.bulkCreate(
        classIds.map((fkClassId) => ({ fkTeacherId: teacher.id, fkClassId })),
        { transaction: t },
      );
    }
    return getById(teacherId, schoolId);
  });
}

module.exports = {
  list,
  getById,
  assignSubjects,
  assignPrimarySubject,
  assignClasses,
};
