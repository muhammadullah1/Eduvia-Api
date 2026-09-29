"use strict";

exports.PLATFORMS = {
  mobile: { type: "isMobile", requiresVersion: true },
  webApp: { type: "isWebApp", requiresVersion: false },
};

exports.USER_ROLES = {
  MANAGEMENT: "management",
  CONTROLLER: "controller",
  ACCOUNTANT: "accountant",
  TEACHER: "teacher",
  PARENT: "parent",
};

/** Roles with full school oversight (management + controller). */
exports.MGMT_ROLES = [
  exports.USER_ROLES.MANAGEMENT,
  exports.USER_ROLES.CONTROLLER,
];

/** Roles that can manage fees (management + accountant + controller). */
exports.FEE_ROLES = [
  exports.USER_ROLES.MANAGEMENT,
  exports.USER_ROLES.ACCOUNTANT,
  exports.USER_ROLES.CONTROLLER,
];

exports.USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "in_active",
  PENDING: "pending",
  BLOCK: "block",
};

exports.STUDENT_STATUS = {
  ACTIVE: "Active",
  PENDING: "Pending",
  WITHDRAWN: "Withdrawn",
};

exports.APPLICATION_STATUS = {
  NEW: "New",
  REVIEW: "Review",
  WAITLIST: "Waitlist",
  ENROLLED: "Enrolled",
  REJECTED: "Rejected",
};

exports.APPLICATION_DECISION = {
  ADMIT: "Admit",
  REJECT: "Reject",
  WAITLIST: "Waitlist",
};

exports.PAYMENT_STATUS = {
  PAID: "Paid",
  PENDING: "Pending",
};

exports.ATTENDANCE_STATUS = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "Leave",
};

exports.SHEET_STATUS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  PUBLISHED: "Published",
};

exports.DOCUMENT_STATUS = {
  PENDING: "Pending",
  UPLOADED: "Uploaded",
  VERIFIED: "Verified",
};

exports.GENDER = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

exports.ABSENCE_STATUS = {
  ABSENT: "Absent",
  COVERED: "Covered",
  CANCELLED: "Cancelled",
  UNMANAGED: "Unmanaged",
};

exports.LESSON_STATUS = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

exports.MONTHLY_RESULT_STATUS = {
  IN_PROGRESS: "InProgress",
  PASSED: "Passed",
  LOW_MARKS: "LowMarks",
  FAILED: "Failed",
};

/** Monthly test rules (documented defaults). */
exports.MONTHLY_TEST_RULES = {
  PASS_PERCENT: 40,
  LOW_MARKS_CEILING_PERCENT: 55,
  FAIL_TEST_COUNT: 2,
  LOW_MARKS_PASS_COUNT: 3,
};

exports.ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
];
