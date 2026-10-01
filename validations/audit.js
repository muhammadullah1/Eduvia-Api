"use strict";

const Joi = require("joi");
const { id } = require("./common");

module.exports = {
  validateList: {
    query: Joi.object({ limit: Joi.number().integer().min(1).max(200), entityType: Joi.string().max(64), entityId: id }),
  },
};
