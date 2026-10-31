"use strict";

/**
 * Dashboard periods: "day" (today), "week" (Monday to Sunday of this week),
 * "month" (this calendar month) and "session" (the school's current academic
 * session). Finance report keys (2026-09, 2026-Q2, FY2026) still work.
 * `from`/`to` are a half-open date range; `months` are the YYYY-MM months it touches;
 * `chartMonths` are the months the trend charts plot.
 */
const { parse, iso, addMonths, today, monthKey, firstOfMonth } = require("./dates");
const { parsePeriod, longMonth, shortMonth } = require("./finance_period");

const DASHBOARD_PRESETS = ["session", "month", "week", "day"];
const DAYS_IN_WEEK = 7;
const MONTH_TREND = 6;
const SUNDAY = 0;

function addDays(day, count) {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + count);
  return iso(d);
}

function monthsTouching(from, to) {
  const out = [];
  for (let m = firstOfMonth(from); m < to; m = addMonths(m, 1)) out.push(monthKey(m));
  return out;
}

function trendEnding(day) {
  const end = addMonths(firstOfMonth(day), 1);
  return monthsTouching(addMonths(firstOfMonth(day), 1 - MONTH_TREND), end);
}

const dayLabel = (day) => `${Number(day.slice(8, 10))} ${shortMonth(monthKey(day))}`;

function weekStart(day) {
  const weekday = parse(day).getUTCDay();
  let back = weekday - 1;
  if (weekday === SUNDAY) back = DAYS_IN_WEEK - 1;
  return addDays(day, -back);
}

/** `session` is the current academic session ({ name, startDate, endDate }) or null. */
function parseDashboardPeriod(key, { day = today(), session = null } = {}) {
  if (!DASHBOARD_PRESETS.includes(key)) return parsePeriod(key);
  if (key === "day") {
    return { key, kind: key, from: day, to: addDays(day, 1), label: `Today, ${dayLabel(day)}`, months: [monthKey(day)], chartMonths: trendEnding(day) };
  }
  if (key === "week") {
    const from = weekStart(day);
    const to = addDays(from, DAYS_IN_WEEK);
    return { key, kind: key, from, to, label: `This week, ${dayLabel(from)} – ${dayLabel(addDays(to, -1))}`, months: monthsTouching(from, to), chartMonths: trendEnding(day) };
  }
  if (key === "session" && session) {
    const from = String(session.startDate).slice(0, 10);
    const to = addDays(String(session.endDate).slice(0, 10), 1);
    const months = monthsTouching(from, to);
    return { key, kind: key, from, to, label: `Session ${session.name}`, months, chartMonths: months };
  }
  const from = firstOfMonth(day);
  const to = addMonths(from, 1);
  return { key: "month", kind: "month", from, to, label: longMonth(monthKey(day)), months: [monthKey(day)], chartMonths: trendEnding(day) };
}

module.exports = { DASHBOARD_PRESETS, parseDashboardPeriod };
