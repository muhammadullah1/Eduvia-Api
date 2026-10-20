"use strict";

const Joi = require("joi");
const { id, idParam, isoMonth } = require("./common");

const examType = Joi.string().valid("Mid-Term", "Monthly Test", "Final Term", "Unit Test");
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

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
    body: Joi.alternatives().try(
      Joi.object({
        papers: Joi.array().items(Joi.object({
          classId: id.required(),
          subjectId: id.required(),
          totalMarks: Joi.number().positive().max(1000).required(),
          passingMarks: Joi.number().min(0).max(1000).required(),
        })).min(1).required(),
        name: Joi.string().max(100).required(),
        examType: examType.required(),
        sessionId: id.required(),
        startDate: isoDate.required(),
        endDate: isoDate.required(),
      }),
      Joi.object({
        classIds: Joi.array().items(id).min(1).required(),
        name: Joi.string().max(100).required(),
        examType: examType.required(),
        sessionId: id.required(),
        startDate: isoDate.required(),
        endDate: isoDate.required(),
        totalMarks: Joi.number().positive().max(1000).required(),
        passingMarks: Joi.number().min(0).max(1000).required(),
      }),
      Joi.object({
        classId: id.required(),
        name: Joi.string().max(120).required(),
        feeMonth: isoMonth.allow(null),
        sessionId: id,
        startDate: isoDate,
        endDate: isoDate,
        examType,
        totalMarks: Joi.number().positive().max(1000),
        passingMarks: Joi.number().min(0).max(1000),
        subjects: Joi.array()
          .items(Joi.object({ subjectId: id.required(), maxScore: Joi.number().positive().default(100), teacherId: id }))
          .min(1)
          .required(),
      }),
    ),
  },
  validateUpdate: {
    ...idParam,
    body: Joi.object({
      name: Joi.string().max(100),
      examType,
      sessionId: id,
      startDate: isoDate.allow(null),
      endDate: isoDate.allow(null),
      totalMarks: Joi.number().positive().max(1000),
      passingMarks: Joi.number().min(0).max(1000),
      classIds: Joi.array().items(id).min(1),
      papers: Joi.array().items(Joi.object({
        classId: id.required(),
        subjectId: id.required(),
        totalMarks: Joi.number().positive().max(1000).required(),
        passingMarks: Joi.number().min(0).max(1000).required(),
      })).min(1),
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
      kind: Joi.string().valid("result-sheet", "mark-sheet", "class-report", "overall").required(),
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
