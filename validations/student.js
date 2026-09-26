"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkClassId: Joi.number().integer().allow(null),
      admissionNo: Joi.string().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      gender: Joi.string().valid("Male", "Female").allow(null),
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
      gender: Joi.string().valid("Male", "Female").allow(null),
      dob: Joi.date().iso().allow(null),
      status: Joi.string().valid("Active", "Pending", "Withdrawn"),
      admittedOn: Joi.date().iso().allow(null),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
