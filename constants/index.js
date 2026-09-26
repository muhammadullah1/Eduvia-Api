"use strict";

exports.PLATFORMS = {
  mobile: { type: "isMobile", requiresVersion: true },
  webApp: { type: "isWebApp", requiresVersion: false },
};

exports.USER_ROLES = {
  MANAGEMENT: "management",
  TEACHER: "teacher",
  PARENT: "parent",
};

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

exports.ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
];
