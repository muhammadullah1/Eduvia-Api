"use strict";

const { Op } = require("sequelize");
const { Classes, Students, TimetableSlots } = require("../models");
const ApiError = require("../utils/ApiError");

function isArchivedClass(row) {
  if (!row) return false;
  const archivedAt =
    row.deletedAt ??
    (typeof row.get === "function" ? row.get("archived_at") : null) ??
    row.archived_at;
  return Boolean(archivedAt);
}

async function assertNoActiveDuplicate(schoolId, sessionId, grade, section, excludeId) {
  const where = {
    fkSchoolId: schoolId,
    fkSessionId: sessionId,
    grade,
    section,
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const active = await Classes.findOne({ where });
  if (active) {
    throw new ApiError(
      409,
      "A class with this name already exists in the current session.",
    );
  }
}

async function attachStats(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const sequelize = Classes.sequelize;

  const studentRows = await Students.findAll({
    attributes: [
      "fkClassId",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    where: {
      fkClassId: { [Op.in]: ids },
      status: { [Op.notIn]: ["Withdrawn", "StruckOff"] },
    },
    group: ["fkClassId"],
    raw: true,
  });

  const subjectRows = await TimetableSlots.findAll({
    attributes: [
      "fkClassId",
      [
        sequelize.fn(
          "COUNT",
          sequelize.fn("DISTINCT", sequelize.col("fk_subject_id")),
        ),
        "count",
      ],
    ],
    where: { fkClassId: { [Op.in]: ids } },
    group: ["fkClassId"],
    raw: true,
  });

  const studentsByClass = new Map(
    studentRows.map((row) => [row.fkClassId, Number(row.count) || 0]),
  );
  const subjectsByClass = new Map(
    subjectRows.map((row) => [row.fkClassId, Number(row.count) || 0]),
  );

  return rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : { ...row };
    json.studentCount = studentsByClass.get(row.id) ?? 0;
    json.subjectCount = subjectsByClass.get(row.id) ?? 0;
    return json;
  });
}

async function list(schoolId, { sessionId, includeStats, archived } = {}) {
  const where = { fkSchoolId: schoolId };
  if (sessionId) where.fkSessionId = sessionId;

  if (archived) {
    where.archived_at = { [Op.ne]: null };
    const rows = await Classes.findAll({
      where,
      paranoid: false,
      order: [["grade", "ASC"], ["section", "ASC"]],
    });
    if (!includeStats) return rows;
    return attachStats(rows);
  }

  const rows = await Classes.findAll({
    where,
    order: [["grade", "ASC"], ["section", "ASC"]],
  });
  if (!includeStats) return rows;
  return attachStats(rows);
}

async function getById(id, schoolId) {
  const row = await Classes.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Class not found");
  return row;
}

async function create(schoolId, data) {
  const { fkSessionId, grade, section } = data;
  await assertNoActiveDuplicate(schoolId, fkSessionId, grade, section);
  const archived = await Classes.findOne({
    where: { fkSchoolId: schoolId, fkSessionId, grade, section },
    paranoid: false,
  });
  if (isArchivedClass(archived)) {
    throw new ApiError(
      409,
      `A class named "${grade}" is already in the archive for this session. Restore it from Settings → Archives instead of creating a new one.`,
    );
  }
  return Classes.create({ ...data, fkSchoolId: schoolId, status: "Active" });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  const grade = data.grade ?? row.grade;
  const section = data.section ?? row.section;
  const sessionId = data.fkSessionId ?? row.fkSessionId;

  if (data.grade !== undefined || data.section !== undefined || data.fkSessionId !== undefined) {
    await assertNoActiveDuplicate(schoolId, sessionId, grade, section, id);
  }

  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  await row.update({ status: "Archived" });
  await row.destroy();
  return true;
}

async function restore(id, schoolId) {
  const row = await Classes.findOne({
    where: { id, fkSchoolId: schoolId },
    paranoid: false,
  });
  if (!row) throw new ApiError(404, "Class not found");
  if (!isArchivedClass(row)) {
    throw new ApiError(400, "This class is already active.");
  }

  await assertNoActiveDuplicate(
    schoolId,
    row.fkSessionId,
    row.grade,
    row.section,
  );

  await row.restore();
  await row.update({ status: "Active" });
  return row;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  restore,
};
