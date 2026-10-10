"use strict";

const Joi = require("joi");
const { id, idParam, isoDay, isoMonth } = require("./common");
const { PAYMENT_STATUS } = require("../constants");

module.exports = {
  validateId: idParam,
  validateGenerate: { body: Joi.object({ month: isoMonth.required(), classId: id }) },
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
      allocations: Joi.array()
        .items(Joi.object({ feeMonthId: id.required(), amount: Joi.number().positive().precision(2).required() }))
        .min(1),
    }),
  },
  validateDay: { query: Joi.object({ date: isoDay }) },
  validateCollections: { query: Joi.object({ date: isoDay, recordedBy: id }) },
  validateSummary: { query: Joi.object({ month: isoMonth }) },
  validateImport: {
    body: Joi.object({
      filename: Joi.string().max(255).required(),
      contentBase64: Joi.string().required(),
    }),
  },
};
