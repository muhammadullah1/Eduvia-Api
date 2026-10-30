"use strict";

const { Applications } = require("../models");
const { APPLICATION_STATUS } = require("../constants");
const { hasPermission } = require("./permission.service");
const ApiError = require("../utils/ApiError");

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Client file names are `<uuid>.<ext>` so nobody can overwrite a chosen key. */
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/i;

/**
 * Upload folders the portal may write to. Each one names who may upload and
 * which content types are accepted; anything else is refused before signing.
 */
const FOLDERS = [
  {
    pattern: /^avatars$/,
    types: IMAGE_TYPES,
    async authorize(user) {
      if (!hasPermission(user, "users.create")) throw new ApiError(403, "You can't upload profile photos.");
    },
  },
  {
    pattern: /^admissions\/(\d+)\/documents$/,
    types: DOCUMENT_TYPES,
    async authorize(user, [applicationId]) {
      if (!hasPermission(user, "admissions.manage")) throw new ApiError(403, "You can't upload admission documents.");
      const app = await Applications.findOne({ where: { id: applicationId, fkSchoolId: user.schoolId } });
      if (!app) throw new ApiError(404, "Application not found");
      if (app.status === APPLICATION_STATUS.ENROLLED) throw new ApiError(400, "Enrolled applications cannot be edited");
    },
  },
];

const trim = (value) => String(value || "").trim().replace(/^\/+|\/+$/g, "");

/** Throws unless `user` may upload `fileName` of `contentType` into `dirName`. */
async function assertCanUpload(user, { dirName, fileName, contentType }) {
  const dir = trim(dirName);
  const folder = FOLDERS.find((item) => item.pattern.test(dir));
  if (!folder) throw new ApiError(400, "Unknown upload folder.");
  if (!FILE_NAME.test(trim(fileName))) throw new ApiError(400, "File name must be a generated id with an extension.");
  if (!folder.types.includes(contentType)) throw new ApiError(400, "This file type isn't allowed here.");
  await folder.authorize(user, dir.match(folder.pattern).slice(1));
}

/** Object keys an application may point its documents at. */
function admissionDocumentKeyPattern(applicationId) {
  return new RegExp(`^admissions/${Number(applicationId)}/documents/${FILE_NAME.source.slice(1)}`, "i");
}

module.exports = { assertCanUpload, admissionDocumentKeyPattern, FILE_NAME };
