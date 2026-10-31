"use strict";

const Joi = require("joi");

module.exports = {
  validateUpdate: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(255),
      phone: Joi.string().trim().max(50).pattern(/^[0-9+()\-\s]*$/).allow("", null)
        .messages({ "string.pattern.base": "Phone may only contain digits, spaces, +, - and brackets." }),
      address: Joi.string().trim().max(500).allow("", null),
      email: Joi.string().trim().email({ tlds: { allow: false } }).max(255),
      website: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(255).allow("", null)
        .messages({ "string.uri": "Website must start with http:// or https://" }),
      logo: Joi.string().trim().max(500).allow("", null),
    }).min(1),
  },
};
