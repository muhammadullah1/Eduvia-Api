"use strict";

const Joi = require("joi");
const { idParam } = require("./common");

const body = Joi.object({
  name: Joi.string().max(120).required(),
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  description: Joi.string().max(1000).allow("", null),
  dateType: Joi.string().valid("single", "multiple"),
});

module.exports = {
  validateList: {
    query: Joi.object({
      search: Joi.string().allow(""),
      archived: Joi.string().valid("true", "false", "1", "0"),
    }),
  },
  validateCreate: { body },
  validateUpdate: {
    ...idParam,
    body: body.fork(["name", "startDate", "endDate"], (schema) => schema.optional()).min(1),
  },
  validateId: idParam,
};
