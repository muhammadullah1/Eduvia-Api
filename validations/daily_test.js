"use strict";

const Joi = require("joi");
const { id, idParam, isoMonth, weekday, period } = require("./common");
const { DAILY_TEST_STATUS } = require("../constants");

module.exports = {
  validateId: idParam,
  validateScheduleList: { query: Joi.object({ classId: id, subjectId: id }) },
  validateSchedule: {
    body: Joi.object({
      classId: id.required(),
      subjectId: id.required(),
      weekday: weekday.required(),
      periodIndex: period.allow(null),
      maxScore: Joi.number().integer().min(1).max(100).default(20),
    }),
  },
  validateGenerate: { body: Joi.object({ month: isoMonth.required(), classId: id }) },
  validateList: {
    query: Joi.object({
      classId: id,
      subjectId: id,
      studentId: id,
      month: isoMonth,
      status: Joi.string().valid(...Object.values(DAILY_TEST_STATUS)),
    }),
  },
  validateMarks: {
    ...idParam,
    body: Joi.object({
      marks: Joi.array()
        .items(Joi.object({ studentId: id.required(), score: Joi.number().min(0).allow(null).required() }))
        .min(1)
        .required(),
    }),
  },
  validateSummary: { query: Joi.object({ classId: id, subjectId: id, month: isoMonth, studentId: id }) },
  validateFlagged: { query: Joi.object({ month: isoMonth }) },
};
