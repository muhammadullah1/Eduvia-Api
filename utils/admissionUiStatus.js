"use strict";

const { APPLICATION_STATUS } = require("../constants");

function resolveAdmissionUiStatus(row) {
  const status = row.status;
  if (status === APPLICATION_STATUS.REJECTED) return "rejected";
  if (status === APPLICATION_STATUS.WAITLIST) return "waitlisted";
  if (status === APPLICATION_STATUS.ENROLLED) return "admitted";
  if (row.interviewDate || row.interviewScore || row.interviewResult) {
    return "test_interview";
  }
  if (status === APPLICATION_STATUS.REVIEW) return "under_review";
  if (status === APPLICATION_STATUS.NEW) {
    return row.submittedOn ? "submitted" : "draft";
  }
  return "submitted";
}

module.exports = { resolveAdmissionUiStatus };
