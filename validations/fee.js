"use strict";

const Joi = require("joi");
const { id, idParam, isoDay, isoMonth, calendarDay, calendarMonth } = require("./common");
const { PAYMENT_STATUS } = require("../constants");

module.exports = {
  validateId: idParam,
  validateGenerate: { body: Joi.object({ month: isoMonth.required(), classId: id }) },
  validateLedger: { params: Joi.object({ studentId: id.required() }) },
  validateMonths: { query: Joi.object({ studentId: id }) },
  validateList: {
    query: Joi.object({ studentId: id, date: isoDay, status: Joi.string().valid(...Object.values(PAYMENT_STATUS)) }),
  },
  validateRecord: {
    body: Joi.object({
      studentId: id.required(),
      amount: Joi.number().positive().precision(2).required(),
      paidOn: isoDay,
      method: Joi.string().valid("Cash", "BankTransfer", "Cheque", "Online").default("Cash"),
      feeType: Joi.string().max(64).default("Tuition"),
      notes: Joi.string().max(500).allow("", null),
      idempotencyKey: Joi.string().max(128),
      // Spend the student's existing credit on open bills before the cash (Step 5).
      applyCredit: Joi.boolean().default(false),
      allocations: Joi.array()
        .items(Joi.object({ feeMonthId: id.required(), amount: Joi.number().positive().precision(2).required() }))
        .min(1),
    }),
  },
  validateCollectSearch: { query: Joi.object({ q: Joi.string().trim().min(2).max(64).required() }) },
  validateCollectStudent: { params: Joi.object({ studentId: id.required() }) },
  validateDay: { query: Joi.object({ date: isoDay }) },
  validateCollections: { query: Joi.object({ date: isoDay, recordedBy: id }) },
  validateSummary: { query: Joi.object({ month: isoMonth }) },
  validateReport: {
    params: Joi.object({ kind: Joi.string().valid("daily", "monthly", "class-wise", "student-wise", "outstanding", "advance", "defaulters").required() }),
    query: Joi.object({
      from: calendarDay,
      to: calendarDay,
      month: calendarMonth,
      classId: id,
      format: Joi.string().valid("json", "csv", "xlsx", "pdf").default("json"),
    }),
  },
  validateImportFile: {
    body: Joi.object({
      fileName: Joi.string().trim().max(255).required(),
      contentBase64: Joi.string().required(),
    }),
  },
  validateImportHistory: {
    query: Joi.object({ limit: Joi.number().integer().min(1).max(200) }),
  },
};
