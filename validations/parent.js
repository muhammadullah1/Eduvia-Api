"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().allow("", null),
      password: Joi.string().min(8),
      relation: Joi.string().default("Guardian"),
      gender: Joi.string().valid("Male", "Female", "Other").allow(null),
    }),
  },
  validateLink: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      studentId: Joi.number().integer().required(),
      isPrimary: Joi.boolean().default(false),
    }),
  },
};
