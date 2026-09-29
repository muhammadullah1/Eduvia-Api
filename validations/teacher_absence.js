"use strict";

const Joi = require("joi");

module.exports = {
  validateCreate: {
    body: Joi.object({
      fkTeacherId: Joi.number().integer().required(),
      fkClassId: Joi.number().integer().required(),
      fkTimetableSlotId: Joi.number().integer().allow(null),
      date: Joi.date().iso().required(),
      periodIndex: Joi.number().integer().min(1).required(),
      status: Joi.string()
        .valid("Absent", "Covered", "Cancelled", "Unmanaged")
        .default("Absent"),
      fkCoverTeacherId: Joi.number().integer().allow(null),
      notes: Joi.string().allow("", null),
    }),
  },
  validateUpdate: {
    params: Joi.object({ id: Joi.number().integer().required() }),
    body: Joi.object({
      status: Joi.string().valid("Absent", "Covered", "Cancelled", "Unmanaged"),
      fkCoverTeacherId: Joi.number().integer().allow(null),
      notes: Joi.string().allow("", null),
      periodIndex: Joi.number().integer().min(1),
      date: Joi.date().iso(),
    }).min(1),
  },
  validateId: {
    params: Joi.object({ id: Joi.number().integer().required() }),
  },
};
