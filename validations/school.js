"use strict";

const Joi = require("joi");

module.exports = {
  validateUpdate: {
    body: Joi.object({
      schoolName: Joi.string().min(2),
      phone: Joi.string(),
      address: Joi.string(),
      email: Joi.string().email(),
      website: Joi.string().allow("", null),
      logo: Joi.string().allow("", null),
    }).min(1),
  },
};
