"use strict";

const Joi = require("joi");

module.exports = {
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer().required(),
    }),
  },
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().required(),
      day: Joi.string().required(),
      time: Joi.string().required(),
      periodIndex: Joi.number().integer().min(1).default(1),
      subject: Joi.string().required(),
      fkSubjectId: Joi.number().integer().allow(null),
      teacher: Joi.string().allow("", null),
      fkTeacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow("", null),
    }),
  },
  validateUpdate: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      day: Joi.string(),
      time: Joi.string(),
      periodIndex: Joi.number().integer().min(1),
      subject: Joi.string(),
      fkSubjectId: Joi.number().integer().allow(null),
      teacher: Joi.string().allow("", null),
      fkTeacherId: Joi.number().integer().allow(null),
      room: Joi.string().allow("", null),
      fkClassId: Joi.number().integer(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
