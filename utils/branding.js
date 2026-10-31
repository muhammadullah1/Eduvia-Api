"use strict";

/**
 * School branding for every server-generated document (report exports, the
 * fee-import template, attendance sheets).
 *
 * It follows the standard of the student result documents (DMC / result
 * card, rendered in the portal by
 * `Eduvia-Frontend/src/features/management/examinations/documents/document-pdf.tsx`):
 * the school crest, the school's name from its `schools` row, and the same
 * emerald palette. `assets/branding/school-crest.jpg` is a 240 px copy of
 * the portal's `src/assets/cls-crest.png`, made for embedding in PDF and XLSX.
 * Keep the palette below in step with that file.
 */
const fs = require("fs");
const path = require("path");
const { Schools, Users } = require("../models");
const storageService = require("../services/storage.service");

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
/** Uploaded logos by object key (keys are unique per upload, so entries never go stale). */
const uploadedLogos = new Map();

/** The school's uploaded JPEG logo, or the default crest when none is set or it can't be read. */
async function logoFor(objectKey) {
  if (!storageService.isObjectKey(objectKey) || !storageService.storageConfig()) return crestJpeg();
  if (uploadedLogos.has(objectKey)) return uploadedLogos.get(objectKey);
  try {
    const { url } = await storageService.signedDownloadUrl(objectKey);
    const res = await fetch(url);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!res.ok || !JPEG_MAGIC.every((byte, i) => bytes[i] === byte)) return crestJpeg();
    uploadedLogos.set(objectKey, bytes);
    return bytes;
  } catch {
    return crestJpeg();
  }
}

/** Hex colours (no "#"), identical to the result documents. */
const COLORS = Object.freeze({
  brand: "047857",
  brandDeep: "064E3B",
  brandWash: "ECFDF5",
  brandLine: "A7F3D0",
  ink: "0F172A",
  muted: "64748B",
  line: "E2E8F0",
});

const CREST_PATH = path.join(__dirname, "..", "assets", "branding", "school-crest.jpg");
let crest;

/** The crest as JPEG bytes (read once). */
function crestJpeg() {
  if (!crest) crest = fs.readFileSync(CREST_PATH);
  return crest;
}

/** "#rrggbb" / "rrggbb" to PDF colour components 0..1. */
function rgb(hex) {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

const fullName = (user) => (user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() : "");

/** "23 Oct 2026, 17:40 PKT": the moment a document is generated, school time. */
function generatedAt(now = new Date()) {
  return `${now.toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" })} PKT`;
}

/**
 * School identity for a document header. `userId` (optional) adds the name
 * of the person generating it.
 */
async function schoolBranding(schoolId, userId) {
  const [school, user] = await Promise.all([
    Schools.findByPk(schoolId, { attributes: ["id", "name", "address", "phone", "email", "website", "logo"] }),
    userId ? Users.findByPk(userId, { attributes: ["firstName", "lastName"] }) : null,
  ]);
  const contact = school ? [school.phone, school.email, school.website].filter(Boolean).join("  |  ") : "";
  return {
    name: school ? school.name : "",
    address: school ? school.address || "" : "",
    contact,
    generatedBy: fullName(user),
    generatedAt: generatedAt(),
    logo: await logoFor(school ? school.logo : null),
    colors: COLORS,
  };
}

module.exports = { rgb, schoolBranding };
