"use strict";

const Joi = require("joi");
const { SETTING_KEYS, RESULT_FEE_RULES, FAIL_GRADE } = require("../constants");
const { CONCESSION_MODES } = require("../constants/concessions");

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
        .items(Joi.string().valid(...CONCESSION_MODES))
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
  [SETTING_KEYS.GRADING]: Joi.object({
    bands: Joi.array()
      .items(Joi.object({
        min: Joi.number().integer().min(0).max(100).required(),
        grade: Joi.string().trim().min(1).max(3).invalid(FAIL_GRADE).required(),
      }))
      .min(2)
      .max(12)
      .unique("min")
      .unique((a, b) => a.grade.toUpperCase() === b.grade.toUpperCase())
      .has(Joi.object({ min: Joi.valid(0) }).unknown())
      .required()
      .messages({
        "array.unique": "Each band needs its own minimum and its own grade.",
        "array.hasUnknown": "One band must start at 0% so every pass gets a grade.",
      }),
  }),
  [SETTING_KEYS.RECEIPT]: Joi.object({
    footerNote: Joi.string().trim().max(300).allow(""),
    showSignatureLine: Joi.boolean(),
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
