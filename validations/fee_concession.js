"use strict";

const Joi = require("joi");
const { id, calendarDay } = require("./common");
const { FEE_TYPES } = require("../constants/finance");

const mode = Joi.string().valid("fixed_payable", "fixed_discount", "percent", "waiver");
const category = Joi.string().valid("Standard", "Scholarship", "Sibling", "Other");

module.exports = {
  validateCreate: {
    body: Joi.object({
      studentId: id.required(),
      sessionId: id.required(),
      familyId: id.optional().allow(null),
      category: category.default("Standard"),
      mode: mode.required(),
      value: Joi.number().min(0).max(9999999999.99).required(),
      priority: Joi.number().integer().min(0).max(10000).default(100),
      stackable: Joi.boolean().default(false),
      maxDiscountAmount: Joi.number().min(0).allow(null),
      effectiveFrom: calendarDay.required(),
      effectiveTo: calendarDay.allow(null),
      feeTypes: Joi.array().items(Joi.string().valid(...FEE_TYPES)).min(1).required(),
      reason: Joi.string().trim().max(500).allow("", null),
      notes: Joi.string().trim().max(1000).allow("", null),
    }),
  },
  validateId: { params: Joi.object({ id: id.required() }) },
  validateStudent: { params: Joi.object({ studentId: id.required() }) },
  validateReject: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ reason: Joi.string().trim().min(5).max(500).required() }),
  },
  validateBreakdown: {
    params: Joi.object({ studentId: id.required() }),
    query: Joi.object({
      month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
      feeType: Joi.string().valid(...FEE_TYPES).default("Tuition"),
    }),
  },
};
