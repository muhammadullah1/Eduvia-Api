"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      name: Joi.string().required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().required(),
      isCurrent: Joi.boolean().default(false),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      name: Joi.string(),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso(),
      isCurrent: Joi.boolean(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
