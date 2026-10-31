"use strict";

/**
 * Apply a single active concession to a fee base amount.
 * No stacking / conflict — one Approved concession per student per fee type.
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function applyMode(base, concession) {
  const amount = round2(base);
  if (!(amount > 0) || !concession) {
    return { discount: 0, net: Math.max(0, amount) };
  }

  const value = Number(concession.value) || 0;
  let discount = 0;

  if (concession.mode === "fixed_discount") {
    discount = Math.min(amount, value);
  } else if (concession.mode === "fixed_payable") {
    discount = amount - value;
  } else if (concession.mode === "percent") {
    discount = Math.min(amount, (amount * value) / 100);
  } else if (concession.mode === "waiver") {
    discount = amount;
  } else {
    discount = 0;
  }

  discount = round2(Math.min(amount, Math.max(0, discount)));
  return { discount, net: round2(amount - discount) };
}

/**
 * @param {number} base
 * @param {object|null} concession Single Approved concession or null
 */
function resolveConcession(base, concession) {
  const amount = round2(Number(base) || 0);
  if (!concession) {
    return {
      conflict: false,
      discount: 0,
      net: amount,
      applied: [],
    };
  }
  const step = applyMode(amount, concession);
  return {
    conflict: false,
    discount: step.discount,
    net: step.net,
    applied: [
      {
        id: concession.id,
        mode: concession.mode,
        value: Number(concession.value),
        discount: step.discount,
        reasonId: concession.fkReasonId || concession.reasonId || null,
        reasonLabel: concession.reasonLabel || concession.reason || null,
      },
    ],
  };
}

/** @deprecated Use resolveConcession — kept name for older call sites during cutover. */
function resolveConcessions(base, candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (!list.length) return resolveConcession(base, null);
  return resolveConcession(base, list[0]);
}

module.exports = { resolveConcession, resolveConcessions, applyMode, round2 };
