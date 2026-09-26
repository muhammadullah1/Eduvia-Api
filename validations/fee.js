"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkStudentId: Joi.number().integer().required(),
      period: Joi.string().required(),
      type: Joi.string().required(),
      amount: Joi.number().positive().required(),
      method: Joi.string().allow("", null),
      status: Joi.string().valid("Paid", "Pending").default("Pending"),
      paidOn: Joi.date().iso().allow(null),
      ref: Joi.string().allow("", null),
    }),
  },
};
