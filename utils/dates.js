"use strict";

const { WEEKDAYS } = require("../constants");

/** Date helpers on ISO `YYYY-MM-DD` strings (UTC-safe, no local-time drift). */
function parse(date) {
  return new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function weekdayOf(date) {
  return WEEKDAYS[parse(date).getUTCDay()];
}

function monthKey(date) {
  return String(date).slice(0, 7);
}

function firstOfMonth(date) {
  return `${monthKey(date)}-01`;
}

function addMonths(monthStart, count) {
  const d = parse(monthStart);
  d.setUTCMonth(d.getUTCMonth() + count, 1);
  return iso(d);
}

function weekOfMonth(date) {
  return Math.floor((parse(date).getUTCDate() - 1) / 7) + 1;
}

/** Every date in `month` (YYYY-MM) that falls on `weekday`. */
function datesForWeekday(month, weekday) {
  const d = parse(`${month}-01`);
  const out = [];
  while (iso(d).startsWith(month)) {
    if (WEEKDAYS[d.getUTCDay()] === weekday) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** The school's calendar day, from the server's local clock (not UTC). */
function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `YYYY-MM-DD` plus whole months, clamped to the month's last day. */
function addMonthsToDate(date, count) {
  const d = parse(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + count);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}

/** Interviews are booked from today up to 18 months ahead. */
function interviewDateRange(now = new Date()) {
  const min = today(now);
  return { min, max: addMonthsToDate(min, 18) };
}

module.exports = {
  parse,
  iso,
  weekdayOf,
  monthKey,
  firstOfMonth,
  addMonths,
  addMonthsToDate,
  weekOfMonth,
  datesForWeekday,
  today,
  interviewDateRange,
};
