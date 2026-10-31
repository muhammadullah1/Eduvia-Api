"use strict";

const Joi = require("joi");
const { id } = require("./common");

module.exports = {
  validateRequest: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({
      deltaCollectible: Joi.number().precision(2).invalid(0).required(),
      reason: Joi.string().trim().min(5).max(500).required(),
    }),
  },
  validateId: { params: Joi.object({ id: id.required() }) },
  validateReject: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ reason: Joi.string().trim().min(5).max(500).required() }),
  },
};
