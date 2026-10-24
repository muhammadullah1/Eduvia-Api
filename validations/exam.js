"use strict";

const Joi = require("joi");
const { id, idParam } = require("./common");

const examType = Joi.string().valid("Mid-Term", "Monthly Test", "Final Term", "Unit Test");
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const clock = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);

/** Paper totals are whole numbers from 1 to 1000; passing can't exceed the total. */
const PAPER_TOTAL_MAX = 1000;
const examName = Joi.string().trim().min(3).max(100).messages({
  "string.min": "Exam name must be at least 3 characters.",
  "string.max": "Exam name must be at most 100 characters.",
  "string.empty": "Give the exam a name.",
});

const papers = Joi.array().items(Joi.object({
  classId: id.required(),
  subjectId: id.required(),
  totalMarks: Joi.number().integer().min(1).max(PAPER_TOTAL_MAX).required().messages({
    "number.base": "Total marks must be a number.",
    "number.integer": "Total marks must be a whole number.",
    "number.min": `Total marks must be between 1 and ${PAPER_TOTAL_MAX}.`,
    "number.max": `Total marks must be between 1 and ${PAPER_TOTAL_MAX}.`,
  }),
  passingMarks: Joi.number().min(0).max(Joi.ref("totalMarks")).required().messages({
    "number.base": "Passing marks must be a number.",
    "number.max": "Passing marks can't be more than the paper's total marks.",
  }),
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
      name: examName.required(),
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
      name: examName,
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
          score: Joi.number().min(0).max(PAPER_TOTAL_MAX).allow(null).messages({
            "number.base": "Marks must be a number.",
          }),
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
      // D9: every result-visibility override records why (SRS addendum §8, p49).
      reason: Joi.string().trim().min(3).max(500).required(),
    }),
  },
  validateOverride: {
    ...idParam,
    body: Joi.object({ studentId: id.required(), reason: Joi.string().trim().min(3).max(500).required() }),
  },
  validateRevoke: { params: Joi.object({ overrideId: id.required() }) },
  validateOverrideList: { query: Joi.object({ examId: id }) },
  validateParentResults: { query: Joi.object({ studentId: id.required() }) },
  validateDmc: {
    ...idParam,
    query: Joi.object({ studentId: id.required(), format: Joi.string().valid("pdf", "json") }),
  },
};
