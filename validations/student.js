"use strict";

const Joi = require("joi");
const { STUDENT_STATUS, GENDER } = require("../constants");
const { id, isoDay } = require("./common");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().allow(null),
      admissionNo: Joi.string().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      gender: Joi.string().valid(...Object.values(GENDER)).allow(null),
      dob: Joi.date().iso().allow(null),
      status: Joi.string().valid("Active", "Pending", "Withdrawn"),
      admittedOn: Joi.date().iso().allow(null),
    }),
  },
  validateUpdate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().allow(null),
      admissionNo: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string(),
      gender: Joi.string().valid(...Object.values(GENDER)).allow(null),
      dob: Joi.date().iso().allow(null),
      admittedOn: Joi.date().iso().allow(null),
    }).min(1),
  },
  validateStatus: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      status: Joi.string().valid(...Object.values(STUDENT_STATUS)).required(),
      reason: Joi.string().max(1000).required(),
      effectiveOn: isoDay.required(),
      finalResult: Joi.string().max(255).allow("", null),
      academicStatus: Joi.string().max(255).allow("", null),
    }),
  },
  validatePromote: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      classId: id.required(),
      sessionId: id,
      date: isoDay.required(),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
