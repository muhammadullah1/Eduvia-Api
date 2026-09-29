"use strict";

const Joi = require("joi");

module.exports = {
  validateAssignSubjects: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      subjectIds: Joi.array().items(Joi.number().integer()).default([]),
      primarySubjectId: Joi.number().integer().allow(null),
    }),
  },
  validateAssignPrimarySubject: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      primarySubjectId: Joi.number().integer().allow(null).required(),
    }),
  },
  validateAssignClasses: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      classIds: Joi.array().items(Joi.number().integer()).required(),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
