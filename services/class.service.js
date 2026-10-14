"use strict";

const { Op } = require("sequelize");
const { Classes, Students, TimetableSlots } = require("../models");
const ApiError = require("../utils/ApiError");

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
          sequelize.fn("DISTINCT", sequelize.col("fk_subject_id"))
        ),
        "count",
      ],
    ],
    where: { fkClassId: { [Op.in]: ids } },
    group: ["fkClassId"],
    raw: true,
  });

  const studentsByClass = new Map(
    studentRows.map((row) => [row.fkClassId, Number(row.count) || 0])
  );
  const subjectsByClass = new Map(
    subjectRows.map((row) => [row.fkClassId, Number(row.count) || 0])
  );

  return rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : { ...row };
    json.studentCount = studentsByClass.get(row.id) ?? 0;
    json.subjectCount = subjectsByClass.get(row.id) ?? 0;
    return json;
  });
}

async function list(schoolId, { sessionId, includeStats } = {}) {
  const where = { fkSchoolId: schoolId };
  if (sessionId) where.fkSessionId = sessionId;
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
  return Classes.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  await row.update(data);
  return row;
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove };
