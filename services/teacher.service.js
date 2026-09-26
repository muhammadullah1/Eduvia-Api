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
      { model: Subjects, as: "subjects", through: { attributes: [] } },
      { model: Classes, as: "classes", through: { attributes: [] } },
    ],
  });
  if (!row) throw new ApiError(404, "Teacher not found");
  return row;
}

async function assignSubjects(teacherId, schoolId, subjectIds = []) {
  const teacher = await getById(teacherId, schoolId);
  return sequelize.transaction(async (t) => {
    await TeacherSubjects.destroy({ where: { fkTeacherId: teacher.id }, transaction: t });
    if (subjectIds.length) {
      await TeacherSubjects.bulkCreate(
        subjectIds.map((fkSubjectId) => ({ fkTeacherId: teacher.id, fkSubjectId })),
        { transaction: t },
      );
    }
    return getById(teacherId, schoolId);
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

module.exports = { list, getById, assignSubjects, assignClasses };
