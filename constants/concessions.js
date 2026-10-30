"use strict";

/** Simplified concession modes (fixed_payable removed). */
exports.CONCESSION_MODES = ["percent", "fixed_discount", "waiver"];

exports.CONCESSION_STATUSES = [
  "Draft",
  "PendingApproval",
  "Approved",
  "Rejected",
  "Revoked",
  "Superseded",
];

exports.APPROVAL_RULES = ["none", "always", "threshold"];

exports.DEFAULT_CONCESSION_POLICY = {
  allowedModes: ["percent", "fixed_discount", "waiver"],
  approvalRule: "none",
  approvalPercentAbove: null,
  approvalAmountAbove: null,
};

exports.SEED_REASON_LABELS = ["Sibling", "Staff child", "Merit", "Hardship", "Orphan"];
