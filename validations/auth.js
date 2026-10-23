"use strict";

const Joi = require("joi");

module.exports = {
  validatePresignedUrl: {
    body: Joi.object({
      dirName: Joi.string().trim().max(100).required(),
      fileName: Joi.string().trim().max(255).required(),
      contentType: Joi.string().trim().max(100).required(),
    }),
  },
  validateLogin: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      schoolId: Joi.number().integer().optional(),
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
  validateForgotPassword: {
    body: Joi.object({
      email: Joi.string().email().required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),
    }),
  },
  validateResetPassword: {
    body: Joi.object({
      token: Joi.string().required().messages({
        "any.required": "Reset token is required",
      }),
      password: Joi.string().min(8).required().messages({
        "string.min": "Password must be at least 8 characters",
        "any.required": "Password is required",
      }),
    }),
  },
  validateVerifyToken: {
    query: Joi.object({
      token: Joi.string().required().messages({
        "any.required": "Token is required",
      }),
    }),
  },
};
