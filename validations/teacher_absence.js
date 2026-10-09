"use strict";

const Joi = require("joi");
const { id, idParam, isoDay, period } = require("./common");
const { ABSENCE_STATUS } = require("../constants");

module.exports = {
  validateId: idParam,
  validateList: {
    query: Joi.object({
      date: isoDay,
      teacherId: id,
      status: Joi.string().valid(...Object.values(ABSENCE_STATUS)),
    }),
  },
  validateMarkAbsent: {
    body: Joi.object({
      teacherId: id.required(),
      date: isoDay.required(),
      periods: Joi.array().items(period).min(1),
      fullDay: Joi.boolean().default(false),
      notes: Joi.string().max(500).allow("", null),
    }).or("periods", "fullDay"),
  },
  validateAssign: {
    ...idParam,
    body: Joi.object({ substituteTeacherId: id.required(), notes: Joi.string().max(500).allow("", null) }),
  },
};
