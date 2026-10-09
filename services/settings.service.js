"use strict";

const { SchoolSettings } = require("../models");
const { SETTING_DEFAULTS, SETTING_KEYS } = require("../constants");
const { can } = require("../constants/permissions");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

/** Which capability may change each settings group. */
const KEY_PERMISSION = {
  [SETTING_KEYS.DAILY_TEST_RULES]: "settings.academic.update",
  [SETTING_KEYS.RESULT_VISIBILITY]: "settings.fees.update",
  [SETTING_KEYS.FEES]: "settings.fees.update",
  [SETTING_KEYS.ADMISSION]: "settings.academic.update",
};

function permissionFor(key) {
  return KEY_PERMISSION[key] || null;
}

async function get(schoolId, key, options = {}) {
  const row = await SchoolSettings.findOne({ where: { fkSchoolId: schoolId, key }, ...options });
  return { ...SETTING_DEFAULTS[key], ...(row ? row.value : {}) };
}

async function getAll(schoolId) {
  const rows = await SchoolSettings.findAll({ where: { fkSchoolId: schoolId } });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.keys(SETTING_DEFAULTS).map((key) => [key, { ...SETTING_DEFAULTS[key], ...stored[key] }]));
}

async function update(actor, key, value) {
  if (!KEY_PERMISSION[key]) throw new ApiError(404, `Unknown setting "${key}"`);
  if (!can(actor.role, KEY_PERMISSION[key])) throw new ApiError(403, "You cannot change this setting.");
  const previous = await get(actor.schoolId, key);
  const next = { ...previous, ...value };
  const [row] = await SchoolSettings.findOrCreate({
    where: { fkSchoolId: actor.schoolId, key },
    defaults: { value: next, fkUpdatedByUserId: actor.id },
  });
  await row.update({ value: next, fkUpdatedByUserId: actor.id });
  await auditService.record(actor, `updated setting ${key}`, {
    entityType: "school_setting",
    entityId: row.id,
    metadata: { key, previous, next },
  });
  return next;
}

module.exports = { get, getAll, update, permissionFor };
