"use strict";

const { validateCreate, validateRows } = require("../../validations/exam");

const paper = { classId: 1, subjectId: 2, totalMarks: 100, passingMarks: 40 };
const exam = (overrides = {}) => ({
  name: "Mid Term 2026",
  examType: "Mid-Term",
  sessionId: 1,
  startDate: "2026-11-01",
  endDate: "2026-11-15",
  papers: [paper],
  ...overrides,
});
const check = (body) => validateCreate.body.validate(body, { convert: true }).error?.message;

describe("exam validation", () => {
  test("accepts a normal exam", () => {
    expect(check(exam())).toBeUndefined();
  });

  test("exam name is trimmed and must be 3–100 characters", () => {
    expect(check(exam({ name: "  " }))).toMatch(/Give the exam a name/);
    expect(check(exam({ name: "ab" }))).toMatch(/at least 3/);
    expect(check(exam({ name: "x".repeat(101) }))).toMatch(/at most 100/);
    expect(validateCreate.body.validate(exam({ name: "  Mid Term  " })).value.name).toBe("Mid Term");
  });

  test("paper totals are whole numbers from 1 to 1000", () => {
    expect(check(exam({ papers: [{ ...paper, totalMarks: 0 }] }))).toMatch(/between 1 and 1000/);
    expect(check(exam({ papers: [{ ...paper, totalMarks: 1001 }] }))).toMatch(/between 1 and 1000/);
    expect(check(exam({ papers: [{ ...paper, totalMarks: 50.5 }] }))).toMatch(/whole number/);
    expect(check(exam({ papers: [{ ...paper, totalMarks: "abc" }] }))).toMatch(/must be a number/);
  });

  test("passing marks can't exceed the paper total", () => {
    expect(check(exam({ papers: [{ ...paper, totalMarks: 50, passingMarks: 60 }] }))).toMatch(/more than the paper's total/);
  });

  test("obtained marks must be numbers", () => {
    const rows = (score) => validateRows.body.validate({ rows: [{ studentId: 1, score }] }).error?.message;
    expect(rows(45)).toBeUndefined();
    expect(rows("4a")).toMatch(/Marks must be a number/);
    expect(rows(-1)).toBeDefined();
  });
});
