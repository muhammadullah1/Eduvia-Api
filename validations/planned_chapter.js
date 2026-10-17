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
      status: Joi.string().valid("Planned", "InProgress", "Completed"),
      sequence: Joi.number().integer().min(1),
    }).min(1),
  },
  validateReorder: {
    body: Joi.object({
      classId: id.required(),
      subjectId: id.required(),
      orderedIds: Joi.array().items(id).min(1).required(),
    }),
  },
};
