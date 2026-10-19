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
      periodCount: Joi.number().integer().min(3).max(9).default(8),
      monthlyFee: Joi.number().min(0).default(0),
      periodStartTimes: Joi.object()
        .pattern(Joi.string().pattern(/^\d+$/), Joi.string().pattern(/^\d{2}:\d{2}$/))
        .optional(),
    }),
  },
  validateList: {
    query: Joi.object({
      sessionId: Joi.number().integer(),
      stats: Joi.string().valid("true", "false", "1", "0"),
      archived: Joi.string().valid("true", "false", "1", "0"),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      fkSessionId: Joi.number().integer(),
      grade: Joi.string(),
      section: Joi.string(),
      label: Joi.string(),
      room: Joi.string().allow("", null),
      periodCount: Joi.number().integer().min(3).max(9),
      monthlyFee: Joi.number().min(0),
      periodStartTimes: Joi.object()
        .pattern(Joi.string().pattern(/^\d+$/), Joi.string().pattern(/^\d{2}:\d{2}$/))
        .optional(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
