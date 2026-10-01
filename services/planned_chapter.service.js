"use strict";

const { PlannedChapters, Classes, Subjects } = require("../models");
const ApiError = require("../utils/ApiError");

/** Chapters/lessons the operations manager plans per class + subject (UR-04 §6.1). */

async function list(schoolId, { classId, subjectId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (subjectId) where.fkSubjectId = subjectId;
  return PlannedChapters.findAll({
    where,
    include: [
      { model: Classes, as: "class", attributes: ["id", "label"] },
      { model: Subjects, as: "subject", attributes: ["id", "name"] },
    ],
    order: [["fkClassId", "ASC"], ["fkSubjectId", "ASC"], ["sequence", "ASC"]],
  });
}

async function getById(id, schoolId) {
  const row = await PlannedChapters.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Planned chapter not found");
  return row;
}

async function create(actor, data) {
  const [klass, subject] = await Promise.all([
    Classes.findOne({ where: { id: data.fkClassId, fkSchoolId: actor.schoolId } }),
    Subjects.findOne({ where: { id: data.fkSubjectId, fkSchoolId: actor.schoolId } }),
  ]);
  if (!klass || !subject) throw new ApiError(404, "Class or subject not found");
  const sequence =
    data.sequence || ((await PlannedChapters.max("sequence", { where: { fkClassId: klass.id, fkSubjectId: subject.id } })) || 0) + 1;
  if (await PlannedChapters.findOne({ where: { fkClassId: klass.id, fkSubjectId: subject.id, sequence } })) {
    throw new ApiError(409, `Chapter ${sequence} already exists for this class and subject.`);
  }
  return PlannedChapters.create({ ...data, sequence, fkSchoolId: actor.schoolId, fkCreatedByUserId: actor.id });
}

async function update(actor, id, data) {
  const row = await getById(id, actor.schoolId);
  await row.update(data);
  return row;
}

async function remove(actor, id) {
  const row = await getById(id, actor.schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove };
