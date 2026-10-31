"use strict";

const Joi = require("joi");
const { id, calendarDay } = require("./common");
const { STUDENT_STATUS } = require("../constants");
const { STUDENT_REPORT_KINDS } = require("../services/school_report.service");

module.exports = {
  validateStudentReport: {
    params: Joi.object({ kind: Joi.string().valid(...STUDENT_REPORT_KINDS).required() }),
    query: Joi.object({
      from: calendarDay,
      to: calendarDay,
      classId: id,
      status: Joi.string().valid(...Object.values(STUDENT_STATUS)),
      format: Joi.string().valid("json", "csv", "xlsx", "pdf").default("json"),
    }),
  },
};
