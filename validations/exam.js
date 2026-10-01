"use strict";

const Joi = require("joi");
const { id, idParam, isoMonth } = require("./common");

const sheetParam = { params: Joi.object({ sheetId: id.required() }) };

module.exports = {
  validateId: idParam,
  validateSheet: sheetParam,
  validateList: { query: Joi.object({ classId: id }) },
  validateCreate: {
    body: Joi.object({
      classId: id.required(),
      name: Joi.string().max(120).required(),
      feeMonth: isoMonth.allow(null),
      sessionId: id,
      subjects: Joi.array()
        .items(Joi.object({ subjectId: id.required(), maxScore: Joi.number().positive().default(100), teacherId: id }))
        .min(1)
        .required(),
    }),
  },
  validateRows: {
    ...sheetParam,
    body: Joi.object({
      rows: Joi.array()
        .items(Joi.object({ studentId: id.required(), score: Joi.number().min(0).allow(null) }))
        .min(1)
        .required(),
    }),
  },
  validateOverride: {
    ...idParam,
    body: Joi.object({ studentId: id.required(), reason: Joi.string().max(500).allow("") }),
  },
  validateRevoke: { params: Joi.object({ overrideId: id.required() }) },
  validateOverrideList: { query: Joi.object({ examId: id }) },
  validateParentResults: { query: Joi.object({ studentId: id.required() }) },
};
