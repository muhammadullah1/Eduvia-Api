"use strict";

const { applyMode, resolveConcession, resolveConcessions } = require("../../utils/concession_resolve");

describe("concession_resolve (single concession)", () => {
  test("fixed_discount and percent and waiver", () => {
    expect(applyMode(1000, { mode: "fixed_discount", value: 200 }).net).toBe(800);
    expect(applyMode(1000, { mode: "percent", value: 10 }).discount).toBe(100);
    expect(applyMode(1000, { mode: "waiver", value: 0 }).net).toBe(0);
  });

  test("resolveConcession applies one row", () => {
    const r = resolveConcession(2000, {
      id: 1,
      mode: "percent",
      value: 25,
      reasonLabel: "Merit",
    });
    expect(r.conflict).toBe(false);
    expect(r.discount).toBe(500);
    expect(r.net).toBe(1500);
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0].reasonLabel).toBe("Merit");
  });

  test("resolveConcessions uses first candidate only (compat)", () => {
    const r = resolveConcessions(1000, [
      { id: 1, mode: "fixed_discount", value: 100 },
      { id: 2, mode: "fixed_discount", value: 900 },
    ]);
    expect(r.discount).toBe(100);
    expect(r.conflict).toBe(false);
  });

  test("null base / empty", () => {
    expect(resolveConcession(0, { mode: "waiver", value: 0 }).net).toBe(0);
    expect(resolveConcession(500, null).net).toBe(500);
  });
});
