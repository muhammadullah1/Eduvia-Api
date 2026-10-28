"use strict";

const Joi = require("joi");
const { id, calendarDay } = require("./common");
const { FEE_TYPES } = require("../constants/finance");

const feeType = Joi.string().valid(...FEE_TYPES);
const classParam = { classId: id.required() };

module.exports = {
  validateGet: {
    params: Joi.object(classParam),
    query: Joi.object({ asOf: calendarDay }),
  },
  validateHistory: {
    params: Joi.object({ ...classParam, feeType: feeType.required() }),
  },
  validateAdd: {
    params: Joi.object(classParam),
    body: Joi.object({
      feeType: feeType.required(),
      amount: Joi.number()
        .positive()
        .max(9999999999.99)
        .custom((v, h) => (Math.abs(Math.round(v * 100) - v * 100) < 1e-6 ? v : h.message("amount can have at most 2 decimal places")))
        .required(),
      // Ignored by the service; session.start_date is always used. Kept optional for older clients.
      effectiveFrom: calendarDay.optional(),
    }),
  },
  validateRemove: {
    params: Joi.object({ ...classParam, feeType: feeType.required() }),
    body: Joi.object({ reason: Joi.string().trim().min(5).max(500).required() }),
  },
};
