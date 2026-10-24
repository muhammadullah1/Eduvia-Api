"use strict";

exports.PLATFORMS = {
  mobile: { type: "isMobile", requiresVersion: true },
  webApp: { type: "isWebApp", requiresVersion: false },
};

exports.USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  OPERATIONS_MANAGER: "operations_manager",
  ACCOUNTANT: "accountant",
  TEACHER: "teacher",
  PARENT: "parent",
};

exports.ALL_ROLES = Object.values(exports.USER_ROLES);

exports.USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "in_active",
  PENDING: "pending",
  BLOCK: "block",
};

exports.STUDENT_STATUS = {
  ACTIVE: "Active",
  PENDING: "Pending",
  INACTIVE: "Inactive",
  GRADUATED: "Graduated",
  STRUCK_OFF: "StruckOff",
  WITHDRAWN: "Withdrawn",
};

/** What a student_status_events row records (SRS 4.3.3). */
exports.LIFECYCLE_EVENT = {
  ENROLLED: "Enrolled",
  DEACTIVATED: "Deactivated",
  REACTIVATED: "Reactivated",
  GRADUATED: "Graduated",
  STRUCK_OFF: "StruckOff",
  WITHDRAWN: "Withdrawn",
  READMITTED: "Readmitted",
};

/** Reason groups. Inactive is temporary; strike-off formally ends enrollment. */
exports.LIFECYCLE_REASONS = {
  Inactive: ["Leave", "Medical", "Fee hold", "Other"],
  StruckOff: ["Transfer out", "Withdrawn by parent", "Long absence", "Disciplinary", "Policy", "Other"],
};

/** Types in the lifecycle history feed: promotion outcomes plus status events. */
exports.LIFECYCLE_HISTORY_TYPES = ["Promoted", "Repeated", ...Object.values(exports.LIFECYCLE_EVENT)];

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
  LATE: "Late",
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
  PENDING: "Pending",
  COVERED: "Covered",
  CANCELLED: "Cancelled",
  NO_CLASS: "NoClass",
};

exports.LESSON_STATUS = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

exports.LESSON_REVIEW_STATUS = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

exports.DAILY_TEST_STATUS = {
  SCHEDULED: "Scheduled",
  MARKS_ENTERED: "MarksEntered",
  PUBLISHED: "Published",
};

exports.MONTHLY_RESULT_STATUS = {
  IN_PROGRESS: "InProgress",
  PASSED: "Passed",
  LOW_MARKS: "LowMarks",
  FAILED: "Failed",
};

exports.FEE_MONTH_STATUS = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  ADVANCE: "Advance",
};

exports.ALLOCATION_MODE = {
  AUTO: "auto",
  MANUAL: "manual",
};

/** Fee rules that decide whether a published result is visible to a parent. */
exports.RESULT_FEE_RULES = {
  ALL_DUE_PAID: "all_due_paid",
  EXAM_MONTH_PAID: "exam_month_paid",
  DISABLED: "disabled",
};

/**
 * School-configurable settings (school_settings table). These are the
 * defaults used until management saves a value; see settings.service.
 */
exports.SETTING_KEYS = {
  DAILY_TEST_RULES: "dailyTestRules",
  RESULT_VISIBILITY: "resultVisibility",
  FEES: "fees",
  ADMISSION: "admission",
  ATTENDANCE: "attendance",
};

exports.SETTING_DEFAULTS = {
  attendance: {
    // Saved marks can be changed up to this many days after the attendance date (0 = same day only).
    editWindowDays: 7,
    // Students below this attendance % are listed as low attendance.
    lowThreshold: 75,
  },
  dailyTestRules: {
    passPercent: 40,
    maxFailsPerMonth: 1,
    lowMarksEnabled: true,
    lowMarksMinPassed: 3,
    lowMarksBelowPercent: 55,
  },
  resultVisibility: {
    feeRule: exports.RESULT_FEE_RULES.ALL_DUE_PAID,
    requireOverrideReason: true,
    rankTie: "shared",
  },
  fees: {
    defaultMonthlyFee: 8500,
    dueDay: 10,
    maxAdvanceMonths: 12,
  },
  admission: {
    prefix: "CLS",
    digits: 4,
  },
};

/**
 * Grade scale (EDUVIA-11). The letter comes from the percentage, but pass/fail
 * comes from each paper's own passing marks:
 *   A+ ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E = passed below 50 · F = failed.
 * A failed paper (or a student who failed any paper) is always F, and a passed
 * paper is never F — e.g. 40/100 with a pass mark of 40 is an E.
 */
exports.GRADE_BANDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 50, grade: "D" },
  { min: 0, grade: "E" },
];

/** Grade shown for any failed paper or failed overall result. */
exports.FAIL_GRADE = "F";

exports.WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** CORS allow-list; set ALLOWED_ORIGINS (comma-separated) per environment. */
exports.ALLOWED_ORIGINS = String(require("../config").get("allowedOrigins"))
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
