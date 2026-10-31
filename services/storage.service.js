"use strict";

const { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config");
const ApiError = require("../utils/ApiError");

/** Upload URLs live 5 minutes; so do signed downloads of private files. */
const UPLOAD_EXPIRES_IN = 300;
const DOWNLOAD_EXPIRES_IN = 300;

let client;
let clientKey;

/**
 * Cloudflare R2 settings (CLOUDFLARE_R2_ENDPOINT, _ACCESS_KEY_ID,
 * _SECRET_ACCESS_KEY, _BUCKET, optional _PUBLIC_BASE_URL). Null when any of
 * the four required values is missing.
 */
function storageConfig() {
  const r2 = config.get("cloudFareR2");
  const required = [r2.endpoint, r2.accessKeyId, r2.secretAccessKey, r2.bucket];
  if (required.some((value) => !value)) return null;
  return {
    endpoint: r2.endpoint,
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    bucket: r2.bucket,
    publicBaseUrl: (r2.publicBaseUrl || "").replace(/\/+$/, ""),
  };
}

function requireConfig() {
  // Looked up through exports so tests can simulate missing configuration.
  const cfg = module.exports.storageConfig();
  if (!cfg) throw new ApiError(503, "File storage is not configured");
  return cfg;
}

function s3(cfg) {
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (!client || clientKey !== key) {
    client = new S3Client({
      region: "auto",
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    clientKey = key;
  }
  return client;
}

const trimSlashes = (value) => String(value).trim().replace(/^\/+|\/+$/g, "");

/** `dirName/fileName` with surrounding slashes trimmed from both parts. */
function objectKeyFor(dirName, fileName) {
  return [trimSlashes(dirName), trimSlashes(fileName)].filter(Boolean).join("/");
}

/** Public URL for a key, or null when no public base URL is configured. */
function publicUrlFor(objectKey, cfg = storageConfig()) {
  if (!cfg || !cfg.publicBaseUrl || !objectKey) return null;
  return `${cfg.publicBaseUrl}/${objectKey}`;
}

/**
 * Presigned PUT for a direct browser upload (the API never sees the bytes). R2 has no presigned POST
 * (so no content-length-range policy); instead Content-Type and the exact Content-Length are signed,
 * and R2 refuses a body of another type or size.
 */
async function presignUpload({ dirName, fileName, contentType, contentLength }) {
  const cfg = requireConfig();
  const objectKey = objectKeyFor(dirName, fileName);
  const command = new PutObjectCommand({ Bucket: cfg.bucket, Key: objectKey, ContentType: contentType, ContentLength: contentLength });
  const uploadUrl = await getSignedUrl(s3(cfg), command, {
    expiresIn: UPLOAD_EXPIRES_IN,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return {
    uploadUrl,
    fileUrl: publicUrlFor(objectKey, cfg),
    objectKey,
    bucket: cfg.bucket,
    contentType,
    contentLength,
    expiresIn: UPLOAD_EXPIRES_IN,
  };
}

/** Short-lived signed GET for a private object. Callers check access first. */
async function signedDownloadUrl(objectKey, expiresIn = DOWNLOAD_EXPIRES_IN) {
  const cfg = requireConfig();
  const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: objectKey });
  return { url: await getSignedUrl(s3(cfg), command, { expiresIn }), expiresIn };
}

/** Size and type of a stored object, or null when it doesn't exist (or storage isn't configured). */
async function objectInfo(objectKey) {
  const cfg = storageConfig();
  if (!cfg || !objectKey) return null;
  try {
    const head = await s3(cfg).send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: objectKey }));
    return { size: Number(head.ContentLength), contentType: head.ContentType };
  } catch {
    return null;
  }
}

/** Best-effort delete; a missing object or storage outage is not fatal. */
async function deleteObject(objectKey) {
  const cfg = storageConfig();
  if (!cfg || !objectKey) return false;
  try {
    await s3(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}

/** True for values we stored as object keys (not legacy URLs or placeholders). */
function isObjectKey(value) {
  return typeof value === "string" && value.length > 0 && !/^[a-z]+:\/\//i.test(value);
}

module.exports = {
  UPLOAD_EXPIRES_IN,
  DOWNLOAD_EXPIRES_IN,
  storageConfig,
  objectKeyFor,
  publicUrlFor,
  presignUpload,
  signedDownloadUrl,
  deleteObject,
  objectInfo,
  isObjectKey,
};
