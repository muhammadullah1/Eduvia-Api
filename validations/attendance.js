"use strict";

const Joi = require("joi");

module.exports = {
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer().required(),
      date: Joi.date().iso().required(),
    }),
  },
  validateMark: {
    body: Joi.object({
      classId: Joi.number().integer().required(),
      date: Joi.date().iso().required(),
      marks: Joi.array()
        .items(
          Joi.object({
            studentId: Joi.number().integer().required(),
            status: Joi.string().valid("Present", "Absent", "Leave").required(),
          }),
        )
        .min(1)
        .required(),
    }),
  },
};
