"use strict";

const Joi = require("joi");

module.exports = {
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer(),
      status: Joi.string().valid("Draft", "Approved", "Published", "Rejected"),
      kind: Joi.string().valid("Homework", "Classwork", "Notice"),
    }),
  },
  validateCreate: {
    body: Joi.object({
      classId: Joi.number().integer().required(),
      kind: Joi.string().valid("Homework", "Classwork", "Notice").required(),
      subject: Joi.string().min(1).max(128).required(),
      text: Joi.string().min(1).max(2000).required(),
      due: Joi.string().allow("", null),
      author: Joi.string().allow("", null),
    }),
  },
  validateUpdateStatus: {
    params: Joi.object({ id: Joi.string().required() }),
    body: Joi.object({
      status: Joi.string().valid("Draft", "Approved", "Published", "Rejected").required(),
    }),
  },
  validateId: {
    params: Joi.object({ id: Joi.string().required() }),
  },
};
