"use strict";

const { MONTHLY_RESULT_STATUS, SETTING_DEFAULTS } = require("../constants");

/** True/false when a score exists, null when the student has no mark yet. */
function isPassedScore(score, maxScore, passPercent) {
  if (score == null || maxScore == null || Number(maxScore) <= 0) return null;
  return (Number(score) / Number(maxScore)) * 100 >= Number(passPercent);
}

/**
 * Monthly subject outcome from the weekly tests (UR-06 / BR-08), using the
 * school's configurable rules:
 *   failed > maxFailsPerMonth                         → Failed + follow-up flag
 *   lowMarks on, passed ≥ minPassed, avg < threshold  → LowMarks
 *   fewer marks than scheduled tests                  → InProgress
 *   otherwise                                         → Passed
 */
function summarizeMonth(marks, testsScheduled, rules = SETTING_DEFAULTS.dailyTestRules) {
  const graded = marks.filter((m) => m.score != null && Number(m.maxScore) > 0);
  const percents = graded.map((m) => (Number(m.score) / Number(m.maxScore)) * 100);
  const passedCount = percents.filter((p) => p >= rules.passPercent).length;
  const failedCount = percents.length - passedCount;
  const averagePercent = percents.length
    ? Math.round((percents.reduce((sum, p) => sum + p, 0) / percents.length) * 100) / 100
    : null;

  let status = MONTHLY_RESULT_STATUS.PASSED;
  if (failedCount > rules.maxFailsPerMonth) status = MONTHLY_RESULT_STATUS.FAILED;
  else if (rules.lowMarksEnabled && passedCount >= rules.lowMarksMinPassed && averagePercent < rules.lowMarksBelowPercent) {
    status = MONTHLY_RESULT_STATUS.LOW_MARKS;
  } else if (graded.length === 0 || graded.length < testsScheduled) status = MONTHLY_RESULT_STATUS.IN_PROGRESS;

  return {
    testsScheduled,
    testsTaken: graded.length,
    passedCount,
    failedCount,
    averagePercent,
    status,
    flaggedForFollowUp: status === MONTHLY_RESULT_STATUS.FAILED,
  };
}

module.exports = { isPassedScore, summarizeMonth };
