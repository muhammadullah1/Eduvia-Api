"use strict";

const Joi = require("joi");
const { id, isoDay } = require("./common");

module.exports = {
  validateList: { query: Joi.object({ studentId: id, status: Joi.string().valid("Pending", "Approved", "Rejected") }) },
  validateCreate: {
    body: Joi.object({
      studentId: id.required(),
      startDate: isoDay.required(),
      endDate: isoDay.required(),
      reason: Joi.string().max(1000).required(),
    }),
  },
  validateReview: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      status: Joi.string().valid("Approved", "Rejected").required(),
      reviewNotes: Joi.string().max(1000).allow("", null),
    }),
  },
};
