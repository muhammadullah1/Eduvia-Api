"use strict";

const { Schools } = require("../models");
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

async function create(data) {
  return Schools.create(data);
}

module.exports = { getById, getCurrent, update, create };
