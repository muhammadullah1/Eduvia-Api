"use strict";

const Joi = require("joi");
const { SETTING_KEYS, RESULT_FEE_RULES } = require("../constants");

const bodies = {
  [SETTING_KEYS.DAILY_TEST_RULES]: Joi.object({
    passPercent: Joi.number().min(1).max(100),
    maxFailsPerMonth: Joi.number().integer().min(0).max(5),
    lowMarksEnabled: Joi.boolean(),
    lowMarksMinPassed: Joi.number().integer().min(1).max(5),
    lowMarksBelowPercent: Joi.number().min(1).max(100),
  }).min(1),
  [SETTING_KEYS.RESULT_VISIBILITY]: Joi.object({
    feeRule: Joi.string().valid(...Object.values(RESULT_FEE_RULES)),
    requireOverrideReason: Joi.boolean(),
    rankTie: Joi.string().valid("shared", "dense"),
  }).min(1),
  [SETTING_KEYS.FEES]: Joi.object({
    dueDay: Joi.number().integer().min(1).max(28),
    maxAdvanceMonths: Joi.number().integer().min(0).max(24),
    concessionPolicy: Joi.object({
      allowedModes: Joi.array()
        .items(Joi.string().valid("percent", "fixed_discount", "waiver"))
        .min(1),
      approvalRule: Joi.string().valid("none", "always", "threshold"),
      approvalPercentAbove: Joi.number().min(0).max(100).allow(null),
      approvalAmountAbove: Joi.number().min(0).allow(null),
    }),
  })
    .min(1)
    .prefs({ stripUnknown: true }),
  [SETTING_KEYS.ADMISSION]: Joi.object({
    prefix: Joi.string().max(20),
    digits: Joi.number().integer().min(1).max(8),
  }).min(1),
  [SETTING_KEYS.ATTENDANCE]: Joi.object({
    editWindowDays: Joi.number().integer().min(0).max(31),
    lowThreshold: Joi.number().integer().min(1).max(100),
  }).min(1),
};

const KEY_ALIASES = {
  "daily-tests": SETTING_KEYS.DAILY_TEST_RULES,
  "daily-test-rules": SETTING_KEYS.DAILY_TEST_RULES,
  "result-visibility": SETTING_KEYS.RESULT_VISIBILITY,
  results: SETTING_KEYS.RESULT_VISIBILITY,
};

module.exports = {
  validateUpdate: {
    params: Joi.object({
      key: Joi.string()
        .valid(...Object.keys(bodies), ...Object.keys(KEY_ALIASES))
        .required(),
    }),
    body: Joi.alternatives().conditional(Joi.ref("/params.key"), {
      switch: [
        ...Object.entries(bodies).map(([key, schema]) => ({ is: key, then: schema })),
        ...Object.entries(KEY_ALIASES).map(([alias, targetKey]) => ({ is: alias, then: bodies[targetKey] })),
      ],
    }),
  },
};
