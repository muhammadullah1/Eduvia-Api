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
  validateCoverPreview: {
    query: Joi.object({
      teacherId: id.required(),
      date: isoDay.required(),
      periods: Joi.string().pattern(/^\d+(,\d+)*$/).required(),
    }),
  },
  validateBulk: {
    body: Joi.object({
      teacherId: id.required(),
      date: isoDay.required(),
      periods: Joi.array().items(period).min(1).unique().required().messages({
        "array.min": "Choose at least one period.",
      }),
      notes: Joi.string().max(500).allow("", null),
      assignments: Joi.array()
        .items(Joi.object({ periodIndex: period.required(), substituteTeacherId: id.required() }))
        .unique("periodIndex")
        .default([]),
    }),
  },
  validateAssign: {
    ...idParam,
    body: Joi.object({ substituteTeacherId: id.required(), notes: Joi.string().max(500).allow("", null) }),
  },
};
