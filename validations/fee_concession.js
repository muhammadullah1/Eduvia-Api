"use strict";

const Joi = require("joi");
const { id, calendarDay } = require("./common");
const { FEE_TYPES } = require("../constants/finance");
const { CONCESSION_MODES } = require("../constants/concessions");

const mode = Joi.string().valid(...CONCESSION_MODES);

module.exports = {
  validateCreate: {
    body: Joi.object({
      studentId: id.required(),
      sessionId: id,
      reasonId: id,
      reasonLabel: Joi.string().trim().max(100),
      mode: mode.required(),
      value: Joi.number().min(0).max(9999999999.99).required(),
      feeType: Joi.string()
        .valid(...FEE_TYPES)
        .default("Tuition"),
      effectiveFrom: calendarDay,
      effectiveTo: calendarDay.allow(null),
      notes: Joi.string().trim().max(2000).allow("", null),
      replaceExisting: Joi.boolean().default(false),
    })
      .or("reasonId", "reasonLabel")
      .required(),
  },
  validateId: {
    params: Joi.object({ id: id.required() }),
  },
  validateStudent: {
    params: Joi.object({ studentId: id.required() }),
  },
  validateBreakdown: {
    params: Joi.object({ studentId: id.required() }),
    query: Joi.object({
      month: Joi.string()
        .pattern(/^\d{4}-\d{2}$/)
        .required(),
      feeType: Joi.string()
        .valid(...FEE_TYPES)
        .default("Tuition"),
    }),
  },
  validateReject: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      reason: Joi.string().trim().min(5).max(500).required(),
    }),
  },
};
