"use strict";

const { today, addMonthsToDate, interviewDateRange } = require("../../utils/dates");
const { validateCreate } = require("../../validations/application");

describe("date helpers", () => {
  test("today() is the local calendar day, not the UTC one", () => {
    // 00:30 local on 6 Nov: in UTC+5 this is still 5 Nov 19:30Z.
    const lateNight = new Date(2026, 10, 6, 0, 30);
    expect(today(lateNight)).toBe("2026-11-06");
  });

  test("addMonthsToDate clamps to the end of shorter months", () => {
    expect(addMonthsToDate("2026-08-31", 18)).toBe("2028-02-29");
    expect(addMonthsToDate("2026-10-19", 18)).toBe("2028-04-19");
  });

  test("interview range runs from today to 18 months ahead", () => {
    expect(interviewDateRange(new Date(2026, 9, 19, 9))).toEqual({ min: "2026-10-19", max: "2028-04-19" });
  });
});

describe("interview date validation", () => {
  const schema = validateCreate.body;
  const base = schema.describe().keys;

  test("accepts a date inside the window and keeps it as YYYY-MM-DD", () => {
    expect(base.interviewDate).toBeDefined();
    const next = addMonthsToDate(today(), 1);
    const { error, value } = schema.extract("interviewDate").validate(next, { convert: true });
    expect(error).toBeUndefined();
    expect(value).toBe(next);
  });

  test("rejects past dates and other formats with a clear message", () => {
    const field = schema.extract("interviewDate");
    expect(field.validate("2020-01-01").error.message).toMatch(/Interview date must be between/);
    expect(field.validate("05/11/2026").error.message).toMatch(/YYYY-MM-DD/);
  });
});
