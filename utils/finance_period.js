"use strict";

/**
 * Finance report periods. The financial year runs April to March (FY 2025-2026 =
 * Apr 2025 .. Mar 2026) and quarters follow it: Q1 Apr-Jun, Q2 Jul-Sep,
 * Q3 Oct-Dec, Q4 Jan-Mar (of the next calendar year).
 *
 *   "2026-09"  month      September 2026
 *   "2026-Q2"  quarter    Q2 2026-27 (Jul–Sep 2026)   (year = the FY's start year)
 *   "FY2025"   financial  FY 2025-26 (Apr 2025 – Mar 2026)
 *
 * Labels match the frontend picker (src/features/finance/periods.ts) exactly.
 *
 * `from` is the first day, `to` the first day AFTER the period (half-open range).
 * `months` lists the YYYY-MM months inside it; `chartMonths` is what the charts
 * plot: the period's months, or for a single month the six months ending there.
 */
const ApiError = require("./ApiError");
const { addMonths, today } = require("./dates");

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PERIOD = /^(?:(\d{4})-(0[1-9]|1[0-2])|(\d{4})-Q([1-4])|FY(\d{4}))$/;
const MONTH_TREND = 6;

const monthOf = (day) => String(day).slice(0, 7);
const shortMonth = (m) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const longMonth = (m) => `${LONG_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function monthsBetween(from, to) {
  const out = [];
  for (let d = from; d < to; d = addMonths(d, 1)) out.push(monthOf(d));
  return out;
}

/** Start year of the financial year containing `month` (YYYY-MM). */
function fyStart(month) {
  const year = Number(month.slice(0, 4));
  return Number(month.slice(5, 7)) >= 4 ? year : year - 1;
}

function parsePeriod(key) {
  const match = PERIOD.exec(String(key || ""));
  if (!match) throw new ApiError(400, "Period must look like 2026-09, 2026-Q2 or FY2026.");
  let kind;
  let from;
  let to;
  let label;
  if (match[1]) {
    kind = "month";
    from = `${match[1]}-${match[2]}-01`;
    to = addMonths(from, 1);
    label = longMonth(monthOf(from));
  } else if (match[3]) {
    kind = "quarter";
    const year = Number(match[3]);
    const q = Number(match[4]);
    from = addMonths(`${year}-04-01`, (q - 1) * 3);
    to = addMonths(from, 3);
    const span = `${MONTH_NAMES[Number(from.slice(5, 7)) - 1]}–${MONTH_NAMES[Number(addMonths(from, 2).slice(5, 7)) - 1]} ${addMonths(from, 2).slice(0, 4)}`;
    label = `Q${q} ${year}-${String(year + 1).slice(2)} (${span})`;
  } else {
    kind = "fy";
    const year = Number(match[5]);
    from = `${year}-04-01`;
    to = `${year + 1}-04-01`;
    label = `FY ${year}-${String(year + 1).slice(2)} (Apr ${year} – Mar ${year + 1})`;
  }
  const months = monthsBetween(from, to);
  const chartMonths = kind === "month" ? monthsBetween(addMonths(from, -(MONTH_TREND - 1)), to) : months;
  return { key: match[0], kind, from, to, label, months, chartMonths };
}

/** Period keys for "now": this month, this quarter, this financial year. */
function currentPeriods(day = today()) {
  const month = monthOf(day);
  const start = fyStart(month);
  const q = Math.floor(((Number(month.slice(5, 7)) + 8) % 12) / 3) + 1;
  return { month, quarter: `${start}-Q${q}`, fy: `FY${start}` };
}

module.exports = { parsePeriod, currentPeriods, fyStart, shortMonth, longMonth, monthOf };
