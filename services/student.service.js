"use strict";

const { Students, Classes, Parents, Users } = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { classId, status, page = 1, pageSize = 50 } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (status) where.status = status;
  const limit = Math.min(Number(pageSize) || 50, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const { rows, count } = await Students.findAndCountAll({
    where,
    include: [{ model: Classes, as: "class", attributes: ["id", "label", "grade", "section"] }],
    order: [["lastName", "ASC"], ["firstName", "ASC"]],
    limit,
    offset,
  });
  return { rows, count, page: Number(page) || 1, pageSize: limit };
}

async function getById(id, schoolId) {
  const row = await Students.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [
      { model: Classes, as: "class" },
      {
        model: Parents,
        as: "parents",
        through: { attributes: ["isPrimary"] },
        include: [{ model: Users, as: "user", attributes: { exclude: ["password"] } }],
      },
    ],
  });
  if (!row) throw new ApiError(404, "Student not found");
  return row;
}

async function create(schoolId, data) {
  return Students.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  await row.update(data);
  return getById(id, schoolId);
}

async function remove(id, schoolId) {
  const row = await Students.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Student not found");
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove };
