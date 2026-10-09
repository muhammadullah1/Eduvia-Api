"use strict";

const Joi = require("joi");
const { id, idParam, isoDay } = require("./common");

module.exports = {
  validateId: idParam,
  validateList: {
    query: Joi.object({
      category: Joi.string().max(64),
      date: isoDay,
      limit: Joi.number().integer().min(1).max(200),
      offset: Joi.number().integer().min(0),
    }),
  },
  validateCreate: {
    body: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      category: Joi.string().max(64).allow("", null),
      amount: Joi.number().positive().precision(2).required(),
      date: isoDay.required(),
    }),
  },
  validateUpdate: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      title: Joi.string().min(1).max(255),
      category: Joi.string().max(64).allow("", null),
      amount: Joi.number().positive().precision(2),
      date: isoDay,
    }).min(1),
  },
};
