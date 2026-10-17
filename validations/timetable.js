"use strict";

const Joi = require("joi");

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const time = Joi.string()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
  .messages({ "string.pattern.base": "Start time must be HH:mm." });

const slotFields = {
  fkClassId: Joi.number().integer().positive(),
  day: Joi.string().valid(...WEEKDAYS),
  time: time,
  periodIndex: Joi.number().integer().min(1).max(16),
  fkSubjectId: Joi.number().integer().positive().allow(null),
  fkTeacherId: Joi.number().integer().positive().allow(null),
  room: Joi.string().max(50).allow("", null),
};

module.exports = {
  WEEKDAYS,
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer().positive(),
    }),
  },
  validateCreate: {
    body: Joi.object({
      ...slotFields,
      fkClassId: slotFields.fkClassId.required(),
      day: slotFields.day.required(),
      time: time.required(),
      periodIndex: slotFields.periodIndex.required(),
      fkSubjectId: Joi.number().integer().positive().required(),
      fkTeacherId: Joi.number().integer().positive().required().messages({
        "any.required": "A teacher is required.",
        "number.base": "A teacher is required.",
      }),
    }),
  },
  validateBatch: {
    body: Joi.object({
      fkClassId: slotFields.fkClassId.required(),
      days: Joi.array()
        .items(Joi.string().valid(...WEEKDAYS))
        .min(1)
        .max(7)
        .unique()
        .required()
        .messages({
          "array.unique": "Each weekday can only be selected once.",
          "array.min": "Select at least one day.",
        }),
      time: time.required(),
      periodIndex: slotFields.periodIndex.required(),
      fkSubjectId: Joi.number().integer().positive().required(),
      fkTeacherId: Joi.number().integer().positive().required().messages({
        "any.required": "A teacher is required.",
        "number.base": "A teacher is required.",
      }),
      room: slotFields.room,
    }),
  },
  validateUpdate: {
    params: Joi.object({ id: Joi.number().integer().positive().required() }),
    body: Joi.object({
      day: slotFields.day,
      time: time,
      periodIndex: slotFields.periodIndex,
      fkSubjectId: slotFields.fkSubjectId,
      fkTeacherId: Joi.number().integer().positive().messages({
        "number.base": "A teacher is required.",
      }),
      room: slotFields.room,
      fkClassId: slotFields.fkClassId,
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().positive().required() }),
  },
};
