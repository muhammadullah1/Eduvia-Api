"use strict";

const { PutObjectCommand, DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const config = require("../config");
const ApiError = require("../utils/ApiError");

let client;

function r2Config() {
  const accountId = config.get("cloudFareR2.accountId");
  const accessKeyId = config.get("cloudFareR2.accessKeyId");
  const secretAccessKey = config.get("cloudFareR2.secretAccessKey");
  const bucket = config.get("cloudFareR2.bucket");
  const endpoint = config.get("cloudFareR2.endpoint");
  const publicBaseUrl = config.get("cloudFareR2.publicBaseUrl");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseUrl: publicBaseUrl || endpoint.replace(/\/$/, ""),
  };
}

function getClient() {
  if (client) return client;
  const cfg = r2Config();
  if (!cfg) {
    throw new ApiError(503, "Document storage is not configured");
  }
  client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return client;
}

function publicUrlForKey(key) {
  const cfg = r2Config();
  if (!cfg) throw new ApiError(503, "Document storage is not configured");
  const base = (cfg.publicBaseUrl || cfg.endpoint).replace(/\/$/, "");
  return `${base}/${cfg.bucket}/${key}`;
}

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

async function createPresignedUpload({ key, contentType }) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ApiError(400, "File type not allowed. Use PDF, JPEG, PNG, or WebP.");
  }
  const cfg = r2Config();
  if (!cfg) throw new ApiError(503, "Document storage is not configured");
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 900 });
  return {
    uploadUrl,
    fileUrl: publicUrlForKey(key),
    maxBytes: MAX_BYTES,
  };
}

async function deleteObject(key) {
  const cfg = r2Config();
  if (!cfg) throw new ApiError(503, "Document storage is not configured");
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
  );
}

module.exports = {
  createPresignedUpload,
  deleteObject,
  publicUrlForKey,
  ALLOWED_TYPES,
  MAX_BYTES,
};
