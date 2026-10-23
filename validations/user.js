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

/** Profile photo: an `avatars/<uuid>.<ext>` object key from the presigned upload. */
const avatarRef = Joi.string()
  .max(300)
  .pattern(/^avatars\/[0-9a-f-]{36}\.(jpe?g|png)$/i)
  .allow("", null)
  .messages({ "string.pattern.base": "Upload the photo through the portal." });

module.exports = {
  validateId: idParam,
  validateCreate: {
    body: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: phoneSchema,
      password: Joi.string().min(8).max(128).allow("", null).empty(["", null]).messages({
        "string.min": "Password must be at least 8 characters.",
      }),
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
      photo: avatarRef,
    }),
  },
  validateUpdate: {
    params: idParam.params,
    body: Joi.object({
      firstName: Joi.string(),
      lastName: Joi.string(),
      phone: phoneSchema,
      photo: avatarRef,
      gender: Joi.string().valid("Male", "Female", "Other").allow(null),
    }).min(1),
  },
};
