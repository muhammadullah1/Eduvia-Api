"use strict";

const Joi = require("joi");
const { id, idParam, calendarDay } = require("./common");
const { PAYMENT_METHODS, INCOME_CATEGORIES } = require("../constants/finance");

/** Other income (Step 8): Donation / Grant / Misc. Fee income is never entered here. */
const fields = {
  category: Joi.string().valid(...INCOME_CATEGORIES).messages({ "any.only": "Choose Donation, Grant or Misc Income" }),
  amount: Joi.number().positive().max(9999999999.99).precision(2).messages({ "number.positive": "Amount must be more than 0" }),
  date: calendarDay,
  description: Joi.string().trim().min(2).max(255),
  referenceNo: Joi.string().trim().max(100).allow("", null),
  receivedFrom: Joi.string().trim().max(255).allow("", null),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS),
  notes: Joi.string().max(2000).allow("", null),
};

module.exports = {
  validateId: idParam,
  validateCreate: {
    body: Joi.object({
      ...fields,
      category: fields.category.required(),
      amount: fields.amount.required(),
      date: fields.date.required(),
      description: fields.description.required(),
    }),
  },
  validateUpdate: { params: Joi.object({ id: id.required() }), body: Joi.object(fields).min(1) },
  validateRemove: {
    params: Joi.object({ id: id.required() }),
    body: Joi.object({ reason: Joi.string().trim().min(3).max(500).required() }),
  },
};
