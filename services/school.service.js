"use strict";

const { Schools, sequelize } = require("../models");
const permissionService = require("./permission.service");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const storageService = require("./storage.service");
const { schoolLogoKeyPattern } = require("./upload_policy.service");

/** How long the signed logo link handed to the portal stays valid. */
const LOGO_LINK_SECONDS = 3600;

/** The school as JSON plus `logoUrl`, a short-lived link to the uploaded logo (null when none). */
async function withLogoUrl(school) {
  const json = school.toJSON();
  json.logoUrl = null;
  if (storageService.isObjectKey(json.logo) && storageService.storageConfig()) {
    json.logoUrl = (await storageService.signedDownloadUrl(json.logo, LOGO_LINK_SECONDS)).url;
  }
  return json;
}

async function getById(id) {
  return Schools.findByPk(id);
}

async function getCurrent(schoolId) {
  const school = await Schools.findByPk(schoolId);
  if (!school) throw new ApiError(404, "School not found");
  return school;
}

const PROFILE_FIELDS = ["name", "phone", "address", "email", "website", "logo"];

/** Edits the school profile (letterhead on every report, receipt and document) and audits what changed. */
async function update(actor, data) {
  const previous = await Schools.findByPk(actor.schoolId, { attributes: ["logo"] });
  const school = await sequelize.transaction(async (transaction) => {
    const school = await Schools.findByPk(actor.schoolId, { transaction });
    if (!school) throw new ApiError(404, "School not found");
    const changes = {};
    PROFILE_FIELDS.forEach((field) => {
      if (data[field] === undefined) return;
      const next = data[field] || null;
      if (next !== school[field]) changes[field] = next;
    });
    if (changes.logo && !schoolLogoKeyPattern(school.id).test(changes.logo)) {
      throw new ApiError(400, "Upload the logo first; it must be a JPEG in this school's logo folder.");
    }
    if (changes.email) {
      const taken = await Schools.findOne({ where: { email: changes.email }, transaction });
      if (taken && taken.id !== school.id) throw new ApiError(409, "Another school already uses this email.");
    }
    if (!Object.keys(changes).length) return school;
    const before = Object.fromEntries(Object.keys(changes).map((field) => [field, school[field]]));
    await school.update(changes, { transaction });
    await auditService.record(actor, "Updated the school profile", {
      entityType: "school",
      entityId: school.id,
      metadata: { before, after: changes },
    }, { transaction });
    return school;
  });
  if (previous && previous.logo !== school.logo && storageService.isObjectKey(previous.logo)) await storageService.deleteObject(previous.logo);
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

module.exports = { getById, getCurrent, update, create, withLogoUrl };
