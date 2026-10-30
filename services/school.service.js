"use strict";

const { Schools, sequelize } = require("../models");
const permissionService = require("./permission.service");
const ApiError = require("../utils/ApiError");

async function getById(id) {
  return Schools.findByPk(id);
}

async function getCurrent(schoolId) {
  const school = await Schools.findByPk(schoolId);
  if (!school) throw new ApiError(404, "School not found");
  return school;
}

async function update(schoolId, data) {
  const school = await Schools.findByPk(schoolId);
  if (!school) throw new ApiError(404, "School not found");
  await school.update(data);
  return school;
}

/** A new school starts with the five system roles and today's default permissions. */
async function create(data) {
  return sequelize.transaction(async (transaction) => {
    const school = await Schools.create(data, { transaction });
    await permissionService.ensureSystemRoles(school.id, transaction);
    return school;
  });
}

module.exports = { getById, getCurrent, update, create };
