"use strict";

/**
 * The admission document checklist every new application starts with, all Pending.
 * Single source: the API creates these rows, serves them to the portal's wizard
 * (GET /applications/document-checklist) and the cleanup keeps exactly these.
 */
exports.REQUIRED_ADMISSION_DOCUMENTS = Object.freeze([
  "Birth Certificate / B-Form",
  "Previous School Leaving Certificate",
  "Guardian ID Copy (CNIC)",
  "Photographs (2 passport size)",
]);

/** Document type stored on checklist rows. */
exports.ADMISSION_DOCUMENT_TYPE = "admission";

/** Status a checklist row starts with. */
exports.INITIAL_DOCUMENT_STATUS = "Pending";
