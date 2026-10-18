"use strict";

const Joi = require("joi");
const { id, idParam } = require("./common");
const { LOCATION_TYPES } = require("../services/location.service");

const fields = {
  name: Joi.string().max(120),
  locationCode: Joi.string().max(40).allow("", null),
  locationType: Joi.string().valid(...LOCATION_TYPES).allow(null, ""),
  description: Joi.string().max(1000).allow("", null),
  capacity: Joi.number().integer().min(1),
};

module.exports = {
  validateList: {
    query: Joi.object({
      search: Joi.string().allow(""),
      archived: Joi.string().valid("true", "false", "1", "0"),
      sessionId: id,
    }),
  },
  validateCreate: {
    body: Joi.object({
      ...fields,
      name: fields.name.required(),
      fkSessionId: id.required(),
      capacity: fields.capacity.required(),
    }),
  },
  validateUpdate: {
    ...idParam,
    body: Joi.object(fields).min(1),
  },
  validateId: idParam,
};
