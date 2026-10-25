"use strict";

const Joi = require("joi");
const { id, idParam, calendarDay, calendarMonth } = require("./common");
const { PAYMENT_METHODS, EXPENSE_CATEGORIES } = require("../constants/finance");

const fields = {
  category: Joi.string().valid(...EXPENSE_CATEGORIES).messages({ "any.only": "Choose a category" }),
  amount: Joi.number().positive().max(9999999999.99).precision(2).messages({ "number.positive": "Amount must be more than 0" }),
  date: calendarDay,
  description: Joi.string().trim().min(2).max(255),
  referenceNo: Joi.string().trim().max(100).allow("", null),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).allow("", null),
  notes: Joi.string().max(2000).allow("", null),
};

module.exports = {
  validateId: idParam,
  validateList: { query: Joi.object({ month: calendarMonth }) },
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
