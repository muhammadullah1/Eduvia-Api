"use strict";

const Joi = require("joi");

/** YYYY-MM, YYYY-Q1..Q4 (FY quarters, Apr-Mar) or FY2026 (Apr 2026 - Mar 2027). */
const period = Joi.string().pattern(/^(\d{4}-(0[1-9]|1[0-2])|\d{4}-Q[1-4]|FY\d{4})$/).message("must be YYYY-MM, YYYY-Q1..Q4 or FYyyyy");

module.exports = {
  validatePeriod: { query: Joi.object({ period }) },
  validateExport: { query: Joi.object({ period, format: Joi.string().valid("pdf", "xlsx", "csv").required() }) },
};
