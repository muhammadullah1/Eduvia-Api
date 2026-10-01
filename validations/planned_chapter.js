"use strict";

const Joi = require("joi");
const { id, idParam, isoDay } = require("./common");

module.exports = {
  validateId: idParam,
  validateList: { query: Joi.object({ classId: id, subjectId: id }) },
  validateCreate: {
    body: Joi.object({
      fkClassId: id.required(),
      fkSubjectId: id.required(),
      sequence: Joi.number().integer().min(1),
      title: Joi.string().max(200).required(),
      description: Joi.string().allow("", null),
      targetDate: isoDay.allow(null),
    }),
  },
  validateUpdate: {
    ...idParam,
    body: Joi.object({
      title: Joi.string().max(200),
      description: Joi.string().allow("", null),
      targetDate: isoDay.allow(null),
    }).min(1),
  },
};
