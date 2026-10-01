"use strict";

const { planOldestFirst, validateManualPlan, feeMonthStatus } = require("../../utils/fee_allocation");

const months = [
  { id: 3, month: "2026-03-01", amountDue: 8500, amountPaid: 0 },
  { id: 1, month: "2026-01-01", amountDue: 8500, amountPaid: 0 },
  { id: 2, month: "2026-02-01", amountDue: 8500, amountPaid: 0 },
];

describe("oldest-unpaid-first allocation (UR-09 / BR-12)", () => {
  test("one month's fee clears January first", () => {
    expect(planOldestFirst(months, 8500)).toEqual({ lines: [{ feeMonthId: 1, amount: 8500 }], leftover: 0 });
  });

  test("a multi-month payment clears in order and leaves the next partial", () => {
    expect(planOldestFirst(months, 20000).lines).toEqual([
      { feeMonthId: 1, amount: 8500 },
      { feeMonthId: 2, amount: 8500 },
      { feeMonthId: 3, amount: 3000 },
    ]);
  });

  test("a partially paid older month is finished before a newer one", () => {
    const partial = [{ ...months[1], amountPaid: 5000 }, months[2]];
    expect(planOldestFirst(partial, 5000).lines).toEqual([
      { feeMonthId: 1, amount: 3500 },
      { feeMonthId: 2, amount: 1500 },
    ]);
  });

  test("money beyond the balance is reported as leftover", () => {
    expect(planOldestFirst(months, 30000).leftover).toBe(4500);
  });

  test("manual allocation cannot exceed a month balance or the payment", () => {
    expect(validateManualPlan(months, 8500, [{ feeMonthId: 3, amount: 8500 }]).lines).toEqual([{ feeMonthId: 3, amount: 8500 }]);
    expect(validateManualPlan(months, 8500, [{ feeMonthId: 3, amount: 9000 }]).error).toMatch(/balance/);
    expect(validateManualPlan(months, 8500, [{ feeMonthId: 1, amount: 8500 }, { feeMonthId: 2, amount: 100 }]).error).toMatch(/exceed/);
    expect(validateManualPlan(months, 8500, [{ feeMonthId: 99, amount: 1 }]).error).toMatch(/does not belong/);
  });

  test("statuses: Unpaid, Partially Paid, Paid, Advance", () => {
    const current = "2026-09-01";
    expect(feeMonthStatus({ amountDue: 8500, amountPaid: 0, month: "2026-09-01" }, current)).toBe("Unpaid");
    expect(feeMonthStatus({ amountDue: 8500, amountPaid: 100, month: "2026-09-01" }, current)).toBe("Partially Paid");
    expect(feeMonthStatus({ amountDue: 8500, amountPaid: 8500, month: "2026-09-01" }, current)).toBe("Paid");
    expect(feeMonthStatus({ amountDue: 8500, amountPaid: 8500, month: "2026-10-01" }, current)).toBe("Advance");
  });
});
