"use strict";

const Joi = require("joi");

module.exports = {
  validateLogin: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
    }),
  },
  validateChangePassword: {
    body: Joi.object({
      newPassword: Joi.string().min(8).required().messages({
        "string.min": "Password must be at least 8 characters",
        "any.required": "New password is required",
      }),
    }),
  },
};
