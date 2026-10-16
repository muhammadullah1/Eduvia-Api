"use strict";

const Joi = require("joi");
const { USER_ROLES } = require("../constants");
const { idParam } = require("./common");
const { isValidPhonePk } = require("../utils/pakistan");

const phoneSchema = Joi.string()
  .allow("", null)
  .custom((value, helpers) => {
    if (!value || !String(value).trim()) return value;
    if (!isValidPhonePk(value)) return helpers.error("any.invalid");
    return value;
  })
  .messages({ "any.invalid": "Enter a valid Pakistani mobile number" });

module.exports = {
  validateId: idParam,
  validateCreate: {
    body: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: phoneSchema,
      password: Joi.string().min(8).required(),
      role: Joi.string()
        .valid(USER_ROLES.SUPER_ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.ACCOUNTANT, USER_ROLES.TEACHER)
        .required(),
      subjectId: Joi.number().integer().when("role", {
        is: USER_ROLES.TEACHER,
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      }),
      gender: Joi.string().valid("Male", "Female", "Other").allow(null),
      employeeCode: Joi.string().allow("", null),
      photo: Joi.string().max(500).allow("", null),
    }),
  },
  validateUpdate: {
    params: idParam.params,
    body: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      phone: phoneSchema,
      photo: Joi.string().max(500).allow("", null),
      gender: Joi.string().valid("Male", "Female", "Other").allow(null),
    }).min(1),
  },
};
