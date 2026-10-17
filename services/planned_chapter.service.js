"use strict";

const { Op } = require("sequelize");
const { PlannedChapters, Classes, Subjects, sequelize } = require("../models");
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
    order: [["fkClassId", "ASC"], ["fkSubjectId", "ASC"], ["chapterNo", "ASC"]],
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
    data.sequence || ((await PlannedChapters.max("chapterNo", { where: { fkClassId: klass.id, fkSubjectId: subject.id } })) || 0) + 1;
  if (await PlannedChapters.findOne({ where: { fkClassId: klass.id, fkSubjectId: subject.id, chapterNo: sequence } })) {
    throw new ApiError(409, `Chapter ${sequence} already exists for this class and subject.`);
  }
  return PlannedChapters.create({
    fkSchoolId: actor.schoolId,
    fkSessionId: klass.fkSessionId,
    fkClassId: klass.id,
    fkSubjectId: subject.id,
    chapterNo: sequence,
    title: data.title,
    plannedEndDate: data.targetDate || data.plannedEndDate || null,
    status: data.status || "Planned",
  });
}

async function update(actor, id, data) {
  const row = await getById(id, actor.schoolId);
  const patch = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.status !== undefined) patch.status = data.status;
  if (data.targetDate !== undefined || data.plannedEndDate !== undefined) {
    patch.plannedEndDate = data.targetDate ?? data.plannedEndDate ?? null;
  }
  if (data.sequence !== undefined || data.chapterNo !== undefined) {
    patch.chapterNo = data.sequence ?? data.chapterNo;
  }
  await row.update(patch);
  return row;
}

async function reorder(actor, { classId, subjectId, orderedIds }) {
  const rows = await PlannedChapters.findAll({
    where: {
      fkSchoolId: actor.schoolId,
      fkClassId: classId,
      fkSubjectId: subjectId,
      id: { [Op.in]: orderedIds },
    },
  });
  if (rows.length !== orderedIds.length) {
    throw new ApiError(400, "Reorder list does not match the chapters for this class and subject.");
  }
  await sequelize.transaction(async (transaction) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await PlannedChapters.update(
        { chapterNo: -(index + 1) },
        { where: { id: orderedIds[index] }, transaction },
      );
    }
    for (let index = 0; index < orderedIds.length; index += 1) {
      await PlannedChapters.update(
        { chapterNo: index + 1 },
        { where: { id: orderedIds[index] }, transaction },
      );
    }
  });
  return list(actor.schoolId, { classId, subjectId });
}

async function remove(actor, id) {
  const row = await getById(id, actor.schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove, reorder };
