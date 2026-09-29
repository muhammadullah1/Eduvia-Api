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
      date: Joi.date().iso().allow(null),
      dueDate: Joi.date().iso().allow(null),
      notes: Joi.string().allow("", null),
      ref: Joi.string().allow("", null),
    }),
  },
  validateStatus: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      status: Joi.string().valid("Paid", "Pending").required(),
    }),
  },
};
