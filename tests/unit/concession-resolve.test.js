"use strict";

const { resolveConcessions, applyMode } = require("../../utils/concession_resolve");
const { feeMonthStatus } = require("../../utils/fee_allocation");
const { FEE_MONTH_STATUS } = require("../../constants");

describe("concession resolve (RejectConflict)", () => {
  test("applies a single percent discount", () => {
    const r = resolveConcessions(1000, [{ id: 1, mode: "percent", value: 10, priority: 1, stackable: false }]);
    expect(r).toMatchObject({ conflict: false, discount: 100, net: 900 });
  });

  test("waiver zeroes the bill", () => {
    const r = resolveConcessions(2500, [{ id: 2, mode: "waiver", value: 100, priority: 1, stackable: false }]);
    expect(r.net).toBe(0);
    expect(r.discount).toBe(2500);
  });

  test("fixed_payable and fixed_discount", () => {
    expect(applyMode(1000, { mode: "fixed_payable", value: 700 }).net).toBe(700);
    expect(applyMode(1000, { mode: "fixed_discount", value: 150 }).discount).toBe(150);
  });

  test("two non-stackable concessions conflict", () => {
    const r = resolveConcessions(1000, [
      { id: 1, mode: "percent", value: 10, priority: 1, stackable: false },
      { id: 2, mode: "fixed_discount", value: 50, priority: 2, stackable: false },
    ]);
    expect(r.conflict).toBe(true);
    expect(r.discount).toBe(0);
    expect(r.conflictIds).toEqual([1, 2]);
  });

  test("non-stackable mixed with stackable conflicts", () => {
    const r = resolveConcessions(1000, [
      { id: 1, mode: "percent", value: 10, priority: 1, stackable: false },
      { id: 2, mode: "fixed_discount", value: 50, priority: 2, stackable: true },
    ]);
    expect(r.conflict).toBe(true);
  });

  test("stackable concessions combine in priority order with max cap", () => {
    const r = resolveConcessions(1000, [
      { id: 2, mode: "percent", value: 10, priority: 2, stackable: true, maxDiscountAmount: 50 },
      { id: 1, mode: "fixed_discount", value: 100, priority: 1, stackable: true },
    ]);
    expect(r.conflict).toBe(false);
    expect(r.discount).toBe(150); // 100 then 10% of 900 capped at 50
    expect(r.net).toBe(850);
  });

  test("eligibility blocked yields zero discount", () => {
    const r = resolveConcessions(1000, [{ id: 1, mode: "waiver", value: 100, priority: 1, stackable: false }], {
      eligibilityBlocked: true,
    });
    expect(r.eligibilityBlocked).toBe(true);
    expect(r.net).toBe(1000);
  });
});

describe("zero-collectible status", () => {
  test("due 0 with paid 0 is Paid", () => {
    expect(feeMonthStatus({ amountDue: 0, amountPaid: 0, month: "2026-10" }, "2026-10")).toBe(FEE_MONTH_STATUS.PAID);
  });
});
