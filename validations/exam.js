"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      examName: Joi.string().required(),
      fkClassId: Joi.number().integer().required(),
      fkSubjectId: Joi.number().integer().allow(null),
      subject: Joi.string().required(),
      maxScore: Joi.number().positive().default(100),
      rows: Joi.array().items(
        Joi.object({
          studentId: Joi.number().integer().required(),
          score: Joi.number().allow(null),
        }),
      ),
    }),
  },
  validateRows: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      rows: Joi.array()
        .items(
          Joi.object({
            studentId: Joi.number().integer().required(),
            score: Joi.number().allow(null),
          }),
        )
        .min(1)
        .required(),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
