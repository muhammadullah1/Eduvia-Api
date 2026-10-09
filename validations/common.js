"use strict";

const Joi = require("joi");
const { WEEKDAYS } = require("../constants");

/** Plain `YYYY-MM-DD` / `YYYY-MM` strings; kept as strings (no Date coercion). */
const isoDay = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message("must be a YYYY-MM-DD date");
const isoMonth = Joi.string().pattern(/^\d{4}-\d{2}$/).message("must be a YYYY-MM month");
const id = Joi.number().integer().positive();
const idParam = { params: Joi.object({ id: id.required() }) };
const weekday = Joi.string().valid(...WEEKDAYS);
const period = Joi.number().integer().min(1).max(16);

module.exports = { isoDay, isoMonth, id, idParam, weekday, period };
