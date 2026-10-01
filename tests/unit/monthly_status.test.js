"use strict";

const { summarizeMonth } = require("../../utils/monthly_status");
const { SETTING_DEFAULTS } = require("../../constants");

const marks = (...scores) => scores.map((score) => ({ score, maxScore: 20 }));
const rules = SETTING_DEFAULTS.dailyTestRules;

describe("monthly weekly-test outcome (UR-06 / BR-08)", () => {
  test("more than one failed test fails the month and flags follow-up", () => {
    const out = summarizeMonth(marks(6, 12, 7, 11), 4, rules);
    expect(out).toMatchObject({ status: "Failed", failedCount: 2, flaggedForFollowUp: true });
  });

  test("exactly one failed test does not fail the month", () => {
    expect(summarizeMonth(marks(7, 14, 13, 15), 4, rules).status).toBe("Passed");
  });

  test("three or more passes with a weak average is LowMarks", () => {
    expect(summarizeMonth(marks(9, 10, 10, 10), 4, rules).status).toBe("LowMarks");
  });

  test("fewer marks than scheduled tests is InProgress", () => {
    expect(summarizeMonth(marks(16, 18), 4, rules).status).toBe("InProgress");
  });

  test("rules are configurable", () => {
    const strict = { ...rules, passPercent: 60, maxFailsPerMonth: 0, lowMarksEnabled: false };
    expect(summarizeMonth(marks(11, 16, 16, 16), 4, strict).status).toBe("Failed");
    expect(summarizeMonth(marks(9, 10, 10, 10), 4, { ...rules, lowMarksEnabled: false }).status).toBe("Passed");
  });
});
