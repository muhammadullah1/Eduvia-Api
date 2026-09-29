"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().required(),
      fkSubjectId: Joi.number().integer().allow(null),
      fkTeacherId: Joi.number().integer().allow(null),
      date: Joi.date().iso().required(),
      periodIndex: Joi.number().integer().min(1).allow(null),
      chapter: Joi.string().required(),
      title: Joi.string().allow("", null),
      notes: Joi.string().allow("", null),
      progress: Joi.number().integer().min(0).max(100).default(0),
      status: Joi.string().valid("Planned", "In progress", "Completed").default("Planned"),
    }),
  },
  validateUpdate: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      chapter: Joi.string(),
      title: Joi.string().allow("", null),
      notes: Joi.string().allow("", null),
      progress: Joi.number().integer().min(0).max(100),
      status: Joi.string().valid("Planned", "In progress", "Completed"),
      periodIndex: Joi.number().integer().min(1).allow(null),
      date: Joi.date().iso(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
