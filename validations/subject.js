"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      name: Joi.string().required(),
      code: Joi.string().required(),
      category: Joi.string().max(50).allow("", null),
      isActive: Joi.boolean(),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      name: Joi.string(),
      code: Joi.string(),
      category: Joi.string().max(50).allow("", null),
      isActive: Joi.boolean(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
