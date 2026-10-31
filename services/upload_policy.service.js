"use strict";

const { Applications, Students } = require("../models");
const { APPLICATION_STATUS } = require("../constants");
const { hasPermission } = require("./permission.service");
const ApiError = require("../utils/ApiError");
const storageService = require("./storage.service");

const IMAGE_TYPES = ["image/jpeg", "image/png"];
/** Photos and logos: the portal enforces the same limit before upload. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Admission documents: the portal enforces the same limit before upload. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
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
    maxBytes: MAX_IMAGE_BYTES,
    async authorize(user) {
      if (!hasPermission(user, "users.create")) throw new ApiError(403, "You can't upload profile photos.");
    },
  },
  {
    pattern: /^school-logos\/(\d+)$/,
    types: ["image/jpeg"],
    maxBytes: MAX_IMAGE_BYTES,
    async authorize(user, [schoolId]) {
      if (!hasPermission(user, "school.update")) throw new ApiError(403, "Only a Super Admin can change the school logo.");
      if (Number(schoolId) !== Number(user.schoolId)) throw new ApiError(403, "You can only upload your own school's logo.");
    },
  },
  {
    pattern: /^students\/(\d+)\/photos$/,
    types: IMAGE_TYPES,
    maxBytes: MAX_IMAGE_BYTES,
    async authorize(user, [studentId]) {
      if (!hasPermission(user, "students.manage")) throw new ApiError(403, "You can't upload student photos.");
      const student = await Students.findOne({ where: { id: studentId, fkSchoolId: user.schoolId }, attributes: ["id"] });
      if (!student) throw new ApiError(404, "Student not found");
    },
  },
  {
    pattern: /^admissions\/(\d+)\/documents$/,
    types: DOCUMENT_TYPES,
    maxBytes: MAX_DOCUMENT_BYTES,
    async authorize(user, [applicationId]) {
      if (!hasPermission(user, "admissions.manage")) throw new ApiError(403, "You can't upload admission documents.");
      const app = await Applications.findOne({ where: { id: applicationId, fkSchoolId: user.schoolId } });
      if (!app) throw new ApiError(404, "Application not found");
      if (app.status === APPLICATION_STATUS.ENROLLED) throw new ApiError(400, "Enrolled applications cannot be edited");
    },
  },
];

const trim = (value) => String(value || "").trim().replace(/^\/+|\/+$/g, "");

/**
 * Throws unless `user` may upload `fileName` of `contentType` and `contentLength` bytes into `dirName`.
 * The length is signed into the upload URL, so R2 refuses a body of any other size.
 */
async function assertCanUpload(user, { dirName, fileName, contentType, contentLength }) {
  const dir = trim(dirName);
  const folder = FOLDERS.find((item) => item.pattern.test(dir));
  if (!folder) throw new ApiError(400, "Unknown upload folder.");
  if (!FILE_NAME.test(trim(fileName))) throw new ApiError(400, "File name must be a generated id with an extension.");
  if (!folder.types.includes(contentType)) throw new ApiError(400, "This file type isn't allowed here.");
  if (contentLength > folder.maxBytes) {
    throw new ApiError(400, `File is too large. The limit is ${folder.maxBytes / (1024 * 1024)} MB.`);
  }
  await folder.authorize(user, dir.match(folder.pattern).slice(1));
}

/**
 * The signed Content-Length makes R2 enforce the size; this second check, run before a record points
 * at an uploaded image, still confirms what landed:
 * it must exist, be one of `types` and at most MAX_IMAGE_BYTES. A rejected upload is deleted.
 * Skipped when storage isn't configured (tests, local dev without R2).
 */
async function assertStoredImage(objectKey, types = IMAGE_TYPES) {
  if (!storageService.storageConfig()) return;
  const info = await storageService.objectInfo(objectKey);
  if (!info) throw new ApiError(400, "The uploaded file wasn't found. Upload it again.");
  if (info.size > MAX_IMAGE_BYTES || !types.includes(info.contentType)) {
    await storageService.deleteObject(objectKey);
    throw new ApiError(400, `Images must be ${types.map((t) => t.replace("image/", "").toUpperCase()).join(" or ")} and at most 2 MB.`);
  }
}

/** Object keys a school's logo may point at (JPEG only: PDFs and XLSX embed it as is). */
function schoolLogoKeyPattern(schoolId) {
  return new RegExp(`^school-logos/${Number(schoolId)}/${FILE_NAME.source.slice(1, -1).replace("[a-z0-9]{1,8}", "jpe?g")}$`, "i");
}

/** Object keys a student's photo may point at (JPEG or PNG). */
function studentPhotoKeyPattern(studentId) {
  return new RegExp(`^students/${Number(studentId)}/photos/${FILE_NAME.source.slice(1, -1).replace("[a-z0-9]{1,8}", "(jpe?g|png)")}$`, "i");
}

/** Object keys an application may point its documents at. */
function admissionDocumentKeyPattern(applicationId) {
  return new RegExp(`^admissions/${Number(applicationId)}/documents/${FILE_NAME.source.slice(1)}`, "i");
}

module.exports = {
  assertCanUpload,
  assertStoredImage,
  admissionDocumentKeyPattern,
  schoolLogoKeyPattern,
  studentPhotoKeyPattern,
  FILE_NAME,
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
};
