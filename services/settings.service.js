"use strict";

const { SchoolSettings } = require("../models");
const { SETTING_DEFAULTS, SETTING_KEYS } = require("../constants");
const { hasPermission } = require("./permission.service");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

/** Which capability may change each settings group. */
const KEY_PERMISSION = {
  [SETTING_KEYS.DAILY_TEST_RULES]: "settings.academic.update",
  [SETTING_KEYS.RESULT_VISIBILITY]: "settings.fees.update",
  [SETTING_KEYS.FEES]: "settings.fees.update",
  [SETTING_KEYS.ADMISSION]: "settings.academic.update",
  [SETTING_KEYS.ATTENDANCE]: "settings.academic.update",
};

function sanitizeFeesValue(value) {
  if (!value || typeof value !== "object") return value;
  const next = { ...value };
  delete next.defaultMonthlyFee;
  delete next.concessionsEnabled;
  if (!next.concessionPolicy || typeof next.concessionPolicy !== "object") {
    next.concessionPolicy = {
      ...SETTING_DEFAULTS[SETTING_KEYS.FEES].concessionPolicy,
    };
  }
  return next;
}

async function get(schoolId, key, options = {}) {
  const row = await SchoolSettings.findOne({ where: { fkSchoolId: schoolId, key }, ...options });
  const merged = { ...SETTING_DEFAULTS[key], ...(row ? row.value : {}) };
  if (key === SETTING_KEYS.FEES) return sanitizeFeesValue(merged);
  return merged;
}

async function getAll(schoolId) {
  const rows = await SchoolSettings.findAll({ where: { fkSchoolId: schoolId } });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    Object.keys(SETTING_DEFAULTS).map((key) => {
      const merged = { ...SETTING_DEFAULTS[key], ...stored[key] };
      if (key === SETTING_KEYS.FEES) return [key, sanitizeFeesValue(merged)];
      return [key, merged];
    }),
  );
}

async function update(actor, key, value) {
  if (!KEY_PERMISSION[key]) throw new ApiError(404, `Unknown setting "${key}"`);
  if (!hasPermission(actor, KEY_PERMISSION[key])) throw new ApiError(403, "You cannot change this setting.");
  const previous = await get(actor.schoolId, key);
  let next = { ...previous, ...value };
  if (key === SETTING_KEYS.FEES) next = sanitizeFeesValue(next);
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

module.exports = { get, getAll, update };
