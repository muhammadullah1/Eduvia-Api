"use strict";

const Joi = require("joi");
const { id, idParam } = require("./common");

const examType = Joi.string().valid("Mid-Term", "Monthly Test", "Final Term", "Unit Test");
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const clock = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);

const papers = Joi.array().items(Joi.object({
  classId: id.required(),
  subjectId: id.required(),
  totalMarks: Joi.number().positive().max(1000).required(),
  passingMarks: Joi.number().min(0).max(1000).required(),
  paperDate: isoDate.allow(null, ""),
  startTime: clock.allow(null, ""),
  endTime: clock.allow(null, ""),
})).min(1);

const sheetParam = { params: Joi.object({ sheetId: id.required() }) };

module.exports = {
  validateId: idParam,
  validateSheet: sheetParam,
  validateList: { query: Joi.object({ classId: id, sessionId: id, view: Joi.string().valid("summary") }) },
  validatePapers: {
    query: Joi.object({
      classIds: Joi.string().pattern(/^\d+(,\d+)*$/).required(),
    }),
  },
  validateCreate: {
    body: Joi.object({
      name: Joi.string().max(100).required(),
      examType: examType.required(),
      sessionId: id.required(),
      startDate: isoDate.required(),
      endDate: isoDate.required(),
      papers: papers.required(),
      rememberDefaults: Joi.boolean(),
    }),
  },
  validateUpdate: {
    ...idParam,
    body: Joi.object({
      name: Joi.string().max(100),
      examType,
      sessionId: id,
      startDate: isoDate.allow(null),
      endDate: isoDate.allow(null),
      papers,
      rememberDefaults: Joi.boolean(),
    }).min(1),
  },
  validateRows: {
    ...sheetParam,
    body: Joi.object({
      rows: Joi.array()
        .items(Joi.object({
          studentId: id.required(),
          score: Joi.number().min(0).allow(null),
          absent: Joi.boolean(),
          exempt: Joi.boolean(),
        }))
        .min(1)
        .required(),
    }),
  },
  validateResults: {
    ...idParam,
    query: Joi.object({ classId: id, subjectId: id }),
  },
  validateDocument: {
    params: Joi.object({
      id: id.required(),
      kind: Joi.string().valid("dmc", "result-sheet", "mark-sheet", "class-report", "overall").required(),
    }),
    query: Joi.object({
      classId: id,
      subjectId: id,
      studentId: id,
      format: Joi.string().valid("pdf", "json"),
    }),
  },
  validateBulkOverride: {
    ...idParam,
    body: Joi.object({
      classId: id,
      reason: Joi.string().max(500).allow(""),
    }),
  },
  validateOverride: {
    ...idParam,
    body: Joi.object({ studentId: id.required(), reason: Joi.string().max(500).allow("") }),
  },
  validateRevoke: { params: Joi.object({ overrideId: id.required() }) },
  validateOverrideList: { query: Joi.object({ examId: id }) },
  validateParentResults: { query: Joi.object({ studentId: id.required() }) },
  validateDmc: {
    ...idParam,
    query: Joi.object({ studentId: id.required(), format: Joi.string().valid("pdf", "json") }),
  },
};
