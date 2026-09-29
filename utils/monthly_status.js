"use strict";

const { MONTHLY_TEST_RULES, MONTHLY_RESULT_STATUS } = require("../constants");

/**
 * Compute monthly status for a student/subject/month.
 * Rules (documented defaults):
 * - pass mark = PASS_PERCENT (40%)
 * - failed_count >= 2 → Failed
 * - else if passed_count >= 3 AND average < LOW_MARKS_CEILING (55%) → LowMarks
 * - else if failed_count === 0 AND tests_taken > 0 → Passed
 * - else → InProgress
 */
function computeMonthlyStatus({ passedCount, failedCount, testsTaken, averagePercent }) {
  const {
    FAIL_TEST_COUNT,
    LOW_MARKS_PASS_COUNT,
    LOW_MARKS_CEILING_PERCENT,
  } = MONTHLY_TEST_RULES;

  if (failedCount >= FAIL_TEST_COUNT) {
    return MONTHLY_RESULT_STATUS.FAILED;
  }
  if (
    passedCount >= LOW_MARKS_PASS_COUNT &&
    averagePercent != null &&
    Number(averagePercent) < LOW_MARKS_CEILING_PERCENT
  ) {
    return MONTHLY_RESULT_STATUS.LOW_MARKS;
  }
  if (testsTaken > 0 && failedCount === 0) {
    return MONTHLY_RESULT_STATUS.PASSED;
  }
  return MONTHLY_RESULT_STATUS.IN_PROGRESS;
}

function isPassedScore(score, maxScore, passPercent = MONTHLY_TEST_RULES.PASS_PERCENT) {
  if (score == null || maxScore == null || Number(maxScore) <= 0) return null;
  const pct = (Number(score) / Number(maxScore)) * 100;
  return pct >= Number(passPercent);
}

module.exports = { computeMonthlyStatus, isPassedScore };
