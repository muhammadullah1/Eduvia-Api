"use strict";

const Joi = require("joi");
const { USER_ROLES } = require("../constants");

module.exports = {
  validateCreate: {
    body: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().allow("", null),
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
    }),
  },
};
