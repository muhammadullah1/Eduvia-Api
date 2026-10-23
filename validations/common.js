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

// Like isoDay/isoMonth but also reject impossible dates (2026-13-40, 2026-02-30).
const realDay = (value, helpers) => {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : helpers.message("must be a real calendar date");
};
const calendarDay = isoDay.custom(realDay);
const calendarMonth = Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).message("must be a YYYY-MM month");

module.exports = { isoDay, isoMonth, calendarDay, calendarMonth, id, idParam, weekday, period };
