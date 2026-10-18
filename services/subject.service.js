"use strict";

const { Op } = require("sequelize");
const { Subjects, TimetableSlots, Classes } = require("../models");
const ApiError = require("../utils/ApiError");

async function timetableUsage(subjectId, schoolId) {
  const slots = await TimetableSlots.findAll({
    where: { fkSubjectId: subjectId, fkSchoolId: schoolId },
    attributes: ["id", "fkClassId"],
    include: [
      {
        model: Classes,
        as: "class",
        attributes: ["id", "label", "fkSessionId"],
      },
    ],
  });
  const classLabels = [
    ...new Set(
      slots
        .map((row) => row.class?.label)
        .filter(Boolean)
    ),
  ];
  return { count: slots.length, classLabels };
}

async function assertNotScheduled(subjectId, schoolId) {
  const { count, classLabels } = await timetableUsage(subjectId, schoolId);
  if (count === 0) return;
  const preview =
    classLabels.length > 0
      ? ` It is scheduled for: ${classLabels.slice(0, 5).join(", ")}${classLabels.length > 5 ? ` +${classLabels.length - 5} more` : ""}.`
      : "";
  throw new ApiError(
    409,
    `This subject is on ${count} timetable period${count === 1 ? "" : "s"} across one or more sessions.${preview} Remove those periods first.`
  );
}

async function list(schoolId, { archived, search } = {}) {
  const where = { fkSchoolId: schoolId };
  if (search && String(search).trim()) {
    where.name = { [Op.iLike]: `%${String(search).trim()}%` };
  }
  if (archived) where.archived_at = { [Op.ne]: null };
  return Subjects.findAll({
    where,
    paranoid: !archived,
    order: [["name", "ASC"]],
  });
}

async function getById(id, schoolId) {
  const row = await Subjects.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Subject not found");
  return row;
}

async function create(schoolId, data) {
  const name = String(data.name || "").trim();
  const active = await Subjects.findOne({
    where: { fkSchoolId: schoolId, name: { [Op.iLike]: name } },
  });
  if (active) {
    throw new ApiError(409, "A subject with this name already exists.");
  }
  const archived = await Subjects.findOne({
    where: { fkSchoolId: schoolId, name: { [Op.iLike]: name } },
    paranoid: false,
  });
  if (archived && archived.deletedAt) {
    throw new ApiError(
      409,
      `A subject named "${name}" is already in the archive. Restore it from Settings → Archives instead of creating a new one.`,
    );
  }
  return Subjects.create({ ...data, name, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  if (data.isActive === false && row.isActive !== false) {
    await assertNotScheduled(id, schoolId);
  }
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  await assertNotScheduled(id, schoolId);
  await row.destroy();
  return true;
}

async function restore(id, schoolId) {
  const row = await Subjects.findOne({
    where: { id, fkSchoolId: schoolId },
    paranoid: false,
  });
  if (!row || !row.deletedAt) throw new ApiError(404, "Archived subject not found");
  const clash = await Subjects.findOne({
    where: {
      fkSchoolId: schoolId,
      name: { [Op.iLike]: row.name },
      id: { [Op.ne]: row.id },
    },
  });
  if (clash) {
    throw new ApiError(409, "An active subject with this name already exists.");
  }
  await row.restore();
  return row;
}

module.exports = { list, getById, create, update, remove, restore };
