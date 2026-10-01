"use strict";

const Joi = require("joi");
const { id, idParam, isoDay, period } = require("./common");
const { LESSON_STATUS, LESSON_REVIEW_STATUS } = require("../constants");

const content = {
  title: Joi.string().max(200).allow("", null),
  periodIndex: period.allow(null),
  classwork: Joi.string().allow("", null),
  homework: Joi.string().allow("", null),
  remarks: Joi.string().allow("", null),
  progress: Joi.number().integer().min(0).max(100),
  status: Joi.string().valid(...Object.values(LESSON_STATUS)),
};

module.exports = {
  validateId: idParam,
  validateList: {
    query: Joi.object({
      classId: id,
      subjectId: id,
      studentId: id,
      date: isoDay,
      from: isoDay,
      to: isoDay,
      reviewStatus: Joi.string().valid(...Object.values(LESSON_REVIEW_STATUS)),
    }),
  },
  validateCreate: {
    body: Joi.object({ classId: id.required(), plannedChapterId: id.required(), date: isoDay.required(), ...content }),
  },
  validateUpdate: { ...idParam, body: Joi.object({ plannedChapterId: id, ...content }).min(1) },
  validateReview: {
    ...idParam,
    body: Joi.object({
      decision: Joi.string().valid(LESSON_REVIEW_STATUS.APPROVED, LESSON_REVIEW_STATUS.REJECTED).required(),
      note: Joi.string().max(500).allow("", null),
    }),
  },
};
