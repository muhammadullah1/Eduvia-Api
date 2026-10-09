"use strict";

const Joi = require("joi");
const { id, idParam, isoDay } = require("./common");

module.exports = {
  validateId: idParam,
  validateChangeSubject: {
    ...idParam,
    body: Joi.object({
      subjectId: id.required(),
      reason: Joi.string().max(500).allow("", null),
      effectiveFrom: isoDay,
    }),
  },
  validateAssignClasses: {
    ...idParam,
    body: Joi.object({ classIds: Joi.array().items(id).required() }),
  },
  validateSchedule: { query: Joi.object({ date: isoDay }) },
  validateTeacherSchedule: { ...idParam, query: Joi.object({ date: isoDay }) },
};
