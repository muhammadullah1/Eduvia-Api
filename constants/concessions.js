"use strict";

/**
 * Concession modes, one per student per fee type:
 * percent off, fixed amount off, fixed amount payable (the student pays exactly this), full waiver.
 */
exports.CONCESSION_MODES = ["percent", "fixed_discount", "fixed_payable", "waiver"];

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
  allowedModes: ["percent", "fixed_discount", "fixed_payable", "waiver"],
  approvalRule: "none",
  approvalPercentAbove: null,
  approvalAmountAbove: null,
};

exports.SEED_REASON_LABELS = ["Sibling", "Staff child", "Merit", "Hardship", "Orphan"];
