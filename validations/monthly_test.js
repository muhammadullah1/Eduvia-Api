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
      fkSessionId: Joi.number().integer().allow(null),
      fkClassId: Joi.number().integer().required(),
      fkSubjectId: Joi.number().integer().allow(null),
      month: Joi.string().required(),
      title: Joi.string().required(),
      maxScore: Joi.number().positive().default(100),
      passPercent: Joi.number().min(0).max(100).default(40),
      testDate: Joi.date().iso().allow(null),
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
