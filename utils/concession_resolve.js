"use strict";

/**
 * Deterministic concession resolution (RejectConflict).
 * Pure: no DB. Callers supply eligible Approved concessions for one fee type.
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function applyMode(base, concession) {
  const value = Number(concession.value) || 0;
  let discount = 0;

  if (concession.mode === "fixed_payable") {
    discount = Math.max(0, base - value);
  } else if (concession.mode === "fixed_discount") {
    discount = Math.min(base, value);
  } else if (concession.mode === "percent") {
    discount = Math.min(base, (base * value) / 100);
  } else if (concession.mode === "waiver") {
    discount = base;
  } else {
    discount = 0;
  }

  if (concession.maxDiscountAmount != null && concession.maxDiscountAmount !== "") {
    discount = Math.min(discount, Number(concession.maxDiscountAmount));
  }

  discount = round2(Math.min(base, Math.max(0, discount)));
  return { discount, net: round2(base - discount) };
}

/**
 * @param {number} base
 * @param {Array<object>} candidates Approved concessions targeting this fee type
 * @returns {{ conflict: boolean, eligibilityBlocked?: boolean, discount: number, net: number, applied: object[], conflictIds?: number[] }}
 */
function resolveConcessions(base, candidates, options = {}) {
  const eligibilityBlocked = Boolean(options.eligibilityBlocked);
  const amount = round2(base);

  if (eligibilityBlocked) {
    return { conflict: false, eligibilityBlocked: true, discount: 0, net: amount, applied: [] };
  }
  if (!candidates || !candidates.length) {
    return { conflict: false, discount: 0, net: amount, applied: [] };
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id - b.id;
  });
  const nonStackable = sorted.filter((c) => !c.stackable);
  const stackable = sorted.filter((c) => c.stackable);

  // RejectConflict: more than one non-stackable, or non-stackable mixed with any other.
  const mixed = nonStackable.length === 1 && stackable.length > 0;
  if (nonStackable.length > 1 || mixed) {
    return {
      conflict: true,
      discount: 0,
      net: amount,
      applied: [],
      conflictIds: sorted.map((c) => c.id),
    };
  }

  let toApply = stackable;
  if (nonStackable.length === 1) {
    toApply = nonStackable;
  }

  let remaining = amount;
  let totalDiscount = 0;
  const applied = [];
  for (const row of toApply) {
    const step = applyMode(remaining, row);
    if (step.discount <= 0) continue;
    totalDiscount = round2(totalDiscount + step.discount);
    remaining = step.net;
    applied.push({
      id: row.id,
      mode: row.mode,
      value: Number(row.value),
      discount: step.discount,
      category: row.category,
    });
  }
  return { conflict: false, discount: totalDiscount, net: remaining, applied };
}

module.exports = { resolveConcessions, applyMode, round2 };
