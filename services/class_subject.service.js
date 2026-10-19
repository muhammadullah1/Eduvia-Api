"use strict";

const { Op } = require("sequelize");
const { ClassSubjects, TimetableSlots, Subjects } = require("../models");

async function ensureOffered(classId, subjectId, transaction) {
  const [row] = await ClassSubjects.findOrCreate({
    where: { fkClassId: classId, fkSubjectId: subjectId },
    defaults: { periodsPerWeek: 5, isElective: false },
    transaction,
  });
  return row;
}

async function pruneIfUnscheduled(classId, subjectId, transaction) {
  if (!classId || !subjectId) return;
  const remaining = await TimetableSlots.count({
    where: { fkClassId: classId, fkSubjectId: subjectId },
    transaction,
  });
  if (remaining > 0) return;
  await ClassSubjects.destroy({
    where: { fkClassId: classId, fkSubjectId: subjectId },
    transaction,
  });
}

async function offeredSubjectIds(schoolId, classId) {
  const [links, slots] = await Promise.all([
    ClassSubjects.findAll({
      where: { fkClassId: classId },
      attributes: ["fkSubjectId"],
    }),
    TimetableSlots.findAll({
      where: { fkSchoolId: schoolId, fkClassId: classId },
      attributes: ["fkSubjectId"],
    }),
  ]);
  return [
    ...new Set(
      [...links.map((row) => row.fkSubjectId), ...slots.map((row) => row.fkSubjectId)].map(Number),
    ),
  ];
}

async function listOffered(schoolId, classId) {
  const ids = await offeredSubjectIds(schoolId, classId);
  if (!ids.length) return [];
  return Subjects.findAll({
    where: { fkSchoolId: schoolId, id: { [Op.in]: ids } },
    order: [["name", "ASC"]],
  });
}

module.exports = {
  ensureOffered,
  pruneIfUnscheduled,
  offeredSubjectIds,
  listOffered,
};
