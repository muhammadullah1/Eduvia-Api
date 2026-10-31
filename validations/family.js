"use strict";

const Joi = require("joi");
const { id } = require("./common");

module.exports = {
  validateCreate: {
    body: Joi.object({
      displayName: Joi.string().trim().min(2).max(150).required(),
      primaryParentId: id.allow(null),
      studentIds: Joi.array().items(id).default([]),
    }),
  },
  validateId: { params: Joi.object({ id: id.required() }) },
  validateMember: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      studentId: id.required(),
      linkedVia: Joi.string().valid("manual", "shared_parent_suggestion").default("manual"),
    }),
  },
  validateRemoveMember: {
    params: Joi.object({ id: id.required(), studentId: id.required() }),
  },
};
