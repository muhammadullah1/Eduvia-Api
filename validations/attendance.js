"use strict";

const Joi = require("joi");
const { isoDay, calendarDay } = require("./common");
const { ATTENDANCE_STATUS } = require("../constants");

const STATUSES = Object.values(ATTENDANCE_STATUS);
const classId = Joi.number().integer().positive();
const month = Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).messages({ "string.pattern.base": "month must be YYYY-MM" });

module.exports = {
  validateList: {
    query: Joi.object({
      classId: Joi.number().integer(),
      date: isoDay,
    }),
  },
  validateMark: {
    body: Joi.object({
      classId: Joi.number().integer().required(),
      date: isoDay.required(),
      marks: Joi.array()
        .items(
          Joi.object({
            studentId: Joi.number().integer().required(),
            status: Joi.string().valid(...STATUSES).required(),
          }),
        )
        .min(1)
        .required(),
    }),
  },
  validateToday: { query: Joi.object({ date: isoDay }) },
  validateDaily: { query: Joi.object({ classId: classId.required(), date: isoDay.required() }) },
  validateSheet: {
    query: Joi.object({
      classId: classId.required(),
      date: calendarDay,
      month,
      format: Joi.string().valid("pdf", "xlsx").default("pdf"),
    }).oxor("date", "month"),
  },
  validateMonthly: { query: Joi.object({ classId: classId.required(), month: month.required() }) },
  validateAbsentees: { query: Joi.object({ date: isoDay.required(), classId }) },
  validateLow: { query: Joi.object({ month: month.required(), classId, threshold: Joi.number().integer().min(1).max(100) }) },
  validateHistory: {
    query: Joi.object({
      classId,
      studentId: Joi.number().integer().positive(),
      from: isoDay,
      to: isoDay,
      q: Joi.string().allow("").max(100),
      page: Joi.number().integer().min(1),
      pageSize: Joi.number().integer().min(1).max(200),
    }),
  },
  validateEdit: {
    params: Joi.object({ id: Joi.number().integer().positive().required() }),
    body: Joi.object({
      status: Joi.string().valid(...STATUSES).required(),
      reason: Joi.string().trim().min(3).max(500).required(),
    }),
  },
  validateCreate: {
    body: Joi.object({
      studentId: Joi.number().integer().positive().required(),
      classId,
      date: isoDay.required(),
      status: Joi.string().valid(...STATUSES).required(),
      reason: Joi.string().trim().min(3).max(500).required(),
    }),
  },
  validateAssign: {
    params: Joi.object({ classId: Joi.number().integer().positive().required() }),
    body: Joi.object({ teacherId: Joi.number().integer().positive().allow(null).required() }),
  },
  validateReminderRead: { params: Joi.object({ id: Joi.number().integer().positive().required() }) },
  validateReminder: { body: Joi.object({ classId: classId.required(), date: isoDay }) },
};
