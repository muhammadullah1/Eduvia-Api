"use strict";

const { hasPermission } = require("../services/permission.service");

/**
 * Fee amounts are Super Admin + Accountant data (parents see their own child's).
 * A few non-fee responses carry them as a side detail: a class's monthly fee,
 * the dues recorded with a strike-off, and audit metadata. For any other role
 * (Operations Manager, teacher) this strips them from every JSON response, so a
 * new endpoint cannot leak them by accident. Outstanding amounts become a plain
 * yes/no `hasOutstanding` flag.
 */
const STRIP = new Set(["monthlyFee", "monthlyTuitionFee", "monthly_tuition_fee", "fixedMonthlyFee", "fixed_monthly_fee", "financialStatus", "creditBalance", "credit_balance"]);
const TO_FLAG = new Set(["outstandingAmount", "outstanding_amount"]);

function seesFeeAmounts(user) {
  return hasPermission(user, "fees.amounts.read");
}

function redact(value, depth = 0) {
  if (depth > 12 || value == null || typeof value !== "object") return value;
  if (typeof value.toJSON === "function" && !(value instanceof Date)) return redact(value.toJSON(), depth);
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (STRIP.has(key)) continue;
    if (TO_FLAG.has(key)) {
      if (!("hasOutstanding" in value)) out.hasOutstanding = inner == null ? null : Number(inner) > 0;
      continue;
    }
    out[key] = redact(inner, depth + 1);
  }
  return out;
}

function redactFeeFields(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => (req.user && !seesFeeAmounts(req.user) ? json(redact(body)) : json(body));
  next();
}

module.exports = { redactFeeFields, redact, seesFeeAmounts };
