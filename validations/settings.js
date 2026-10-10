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
  }).min(1),
  [SETTING_KEYS.FEES]: Joi.object({
    defaultMonthlyFee: Joi.number().min(0),
    dueDay: Joi.number().integer().min(1).max(28),
    maxAdvanceMonths: Joi.number().integer().min(0).max(24),
  }).min(1),
  [SETTING_KEYS.ADMISSION]: Joi.object({
    prefix: Joi.string().max(20),
    digits: Joi.number().integer().min(1).max(8),
  }).min(1),
};

module.exports = {
  validateUpdate: {
    params: Joi.object({ key: Joi.string().valid(...Object.keys(bodies)).required() }),
    body: Joi.alternatives().conditional(Joi.ref("/params.key"), {
      switch: Object.entries(bodies).map(([key, schema]) => ({ is: key, then: schema })),
    }),
  },
};
