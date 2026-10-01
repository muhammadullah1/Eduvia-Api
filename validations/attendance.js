"use strict";

const Joi = require("joi");
const { isoDay } = require("./common");

module.exports = {
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer(),
      date: isoDay,
    }),
  },
  validateMark: {
    body: Joi.object({
      classId: Joi.number().integer().required(),
      date: isoDay.required(),
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
