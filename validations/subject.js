"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      name: Joi.string().required(),
      code: Joi.string().required(),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      name: Joi.string(),
      code: Joi.string(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
