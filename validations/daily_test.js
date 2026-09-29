"use strict";

const Joi = require("joi");

const resultSchema = Joi.object({
  studentId: Joi.number().integer(),
  fkStudentId: Joi.number().integer(),
  score: Joi.number().allow(null),
}).or("studentId", "fkStudentId");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().required(),
      fkSubjectId: Joi.number().integer().allow(null),
      fkTeacherId: Joi.number().integer().allow(null),
      date: Joi.date().iso().required(),
      periodIndex: Joi.number().integer().min(1).allow(null),
      title: Joi.string().required(),
      maxScore: Joi.number().positive().default(20),
      results: Joi.array().items(resultSchema).default([]),
    }),
  },
  validateResults: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      results: Joi.array().items(resultSchema).min(1).required(),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
