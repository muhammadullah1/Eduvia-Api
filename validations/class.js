"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkSessionId: Joi.number().integer().required(),
      grade: Joi.string().required(),
      section: Joi.string().required(),
      label: Joi.string().required(),
      room: Joi.string().allow("", null),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      fkSessionId: Joi.number().integer(),
      grade: Joi.string(),
      section: Joi.string(),
      label: Joi.string(),
      room: Joi.string().allow("", null),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
