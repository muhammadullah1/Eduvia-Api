"use strict";

function cnicDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 13);
}

function isValidCnic(value) {
  return /^\d{13}$/.test(cnicDigits(value));
}

function phoneDigitsPk(value) {
  let raw = String(value || "").replace(/[^\d+]/g, "");
  if (raw.startsWith("+92")) raw = raw.slice(3);
  if (raw.startsWith("92") && raw.length >= 12) raw = raw.slice(2);
  if (raw.startsWith("0")) raw = raw.slice(1);
  return raw.replace(/\D/g, "").slice(0, 10);
}

function isValidPhonePk(value) {
  const d = phoneDigitsPk(value);
  return /^3\d{9}$/.test(d);
}

function normalizePhonePk(value) {
  const d = phoneDigitsPk(value);
  return d ? `0${d}` : "";
}

module.exports = {
  cnicDigits,
  isValidCnic,
  phoneDigitsPk,
  isValidPhonePk,
  normalizePhonePk,
};
