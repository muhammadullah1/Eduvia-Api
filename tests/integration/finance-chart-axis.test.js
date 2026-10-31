"use strict";

/** Finance PDF chart axis: round, distinct tick labels; no axis at all when every value is 0. */
const { sequelize } = require("../../models");
const { axisStep } = require("../../utils/finance_export");

afterAll(() => sequelize.close());

test("all-zero data has no scale instead of repeated 0/1 labels", () => {
  expect(axisStep(0)).toBe(0);
});

test("ticks are round and cover the largest value", () => {
  expect(axisStep(1)).toBe(1);
  expect(axisStep(999)).toBe(250);
  expect(axisStep(263500)).toBe(100000);
  for (const max of [3, 47, 1000, 1234567]) expect(axisStep(max) * 4).toBeGreaterThanOrEqual(max);
});
