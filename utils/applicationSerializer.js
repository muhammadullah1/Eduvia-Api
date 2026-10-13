"use strict";

function serializeDocument(doc) {
  const row = doc && typeof doc.toJSON === "function" ? doc.toJSON() : doc || {};
  return {
    id: row.id,
    label: row.title || row.label || "Document",
    status: row.status || "Pending",
    fileUrl: row.fileUrl ?? null,
  };
}

function serializeApplication(app) {
  const row = app && typeof app.toJSON === "function" ? app.toJSON() : app || {};
  const name = `${row.applicantFirstName || ""} ${row.applicantLastName || ""}`.trim();
  return {
    id: row.id,
    name,
    applicantFirstName: row.applicantFirstName,
    applicantLastName: row.applicantLastName,
    fkClassId: row.fkClassId,
    fkSessionId: row.fkSessionId,
    gradeApplyingFor: row.gradeApplyingFor,
    guardian: row.parentName,
    phone: row.parentPhone,
    email: row.parentEmail,
    dob: row.dateOfBirth,
    gender: row.gender,
    address: row.address,
    previousSchool: row.previousSchool,
    previousClass: row.previousClass,
    guardianRelation: row.guardianRelation,
    guardianAddress: row.guardianAddress,
    interviewType: row.interviewType,
    interviewDate: row.interviewDate,
    interviewScore: row.interviewScore,
    interviewResult: row.interviewResult,
    decision: row.decision,
    status: row.status,
    submittedOn: row.submittedOn,
    notes: row.notes,
    enrolledStudentId: row.enrolledStudentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    documents: (row.documents || []).map(serializeDocument),
  };
}

module.exports = {
  serializeApplication,
  serializeDocument,
};
