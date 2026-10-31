"use strict";

const Joi = require("joi");
const { id } = require("./common");
const { CONCESSION_MODES } = require("../constants/concessions");

module.exports = {
  validateCreate: {
    body: Joi.object({
      label: Joi.string().trim().min(1).max(100).required(),
      defaultMode: Joi.string()
        .valid(...CONCESSION_MODES)
        .allow(null),
      defaultValue: Joi.number().min(0).allow(null),
      sortOrder: Joi.number().integer().min(0).max(9999),
      active: Joi.boolean(),
      requiresFamily: Joi.boolean(),
    }).required(),
  },
  validateUpdate: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      label: Joi.string().trim().min(1).max(100),
      defaultMode: Joi.string()
        .valid(...CONCESSION_MODES)
        .allow(null),
      defaultValue: Joi.number().min(0).allow(null),
      sortOrder: Joi.number().integer().min(0).max(9999),
      active: Joi.boolean(),
      requiresFamily: Joi.boolean(),
    })
      .min(1)
      .required(),
  },
  validateId: {
    params: Joi.object({ id: id.required() }),
  },
};
