"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, RefreshTokens, Users } = require("../models");
const { generateToken } = require("../utils");
const { USER_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const { cookieSettings } = require("../config/runtime");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Two tabs (or a retried request) can present the same token at once. For a
 * short window after rotation the previous token is accepted once more and
 * gets its own fresh pair in the same family; after that it counts as reuse.
 */
const ROTATION_GRACE_MS = 45 * 1000;
const COOKIE_NAME = "eduvia_refresh";

const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const newRaw = () => crypto.randomBytes(48).toString("base64url");

function accessTokenFor(user) {
  return generateToken(
    { id: user.id, schoolId: user.fkSchoolId, role: user.role, email: user.email },
    ACCESS_TOKEN_TTL,
  );
}

/** Creates a refresh token; returns the raw value (only ever sent in the cookie). */
async function issue(userId, familyId = crypto.randomUUID(), transaction) {
  const raw = newRaw();
  const row = await RefreshTokens.create(
    { fkUserId: userId, tokenHash: hash(raw), familyId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    { transaction },
  );
  return { raw, row };
}

async function revokeFamily(familyId, transaction) {
  await RefreshTokens.update(
    { revokedAt: new Date() },
    { where: { familyId, revokedAt: { [Op.is]: null } }, transaction },
  );
}

const invalid = () => new ApiError(401, "Your session has expired. Please sign in again.");

/**
 * Exchanges a refresh token for a new access token and a new refresh token.
 * Presenting an already-rotated token is treated as theft: the whole family is revoked.
 */
async function rotate(raw) {
  if (!raw) throw invalid();
  const result = await sequelize.transaction(async (transaction) => {
    const current = await RefreshTokens.findOne({
      where: { tokenHash: hash(raw) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!current) return { error: invalid() };
    if (current.revokedAt) {
      const withinGrace =
        current.replacedById &&
        !current.graceUsedAt &&
        Date.now() - new Date(current.revokedAt).getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        await revokeFamily(current.familyId, transaction);
        return { error: invalid() };
      }
      const successor = await RefreshTokens.findByPk(current.replacedById, { transaction });
      const user = successor && !successor.revokedAt ? await Users.findByPk(current.fkUserId, { transaction }) : null;
      // A revoked successor means logout or theft handling already ran.
      if (!user || user.status === USER_STATUS.BLOCK) return { error: invalid() };
      const sibling = await issue(user.id, current.familyId, transaction);
      await current.update({ graceUsedAt: new Date() }, { transaction });
      return { refreshToken: sibling.raw, token: accessTokenFor(user) };
    }
    if (current.expiresAt <= new Date()) {
      await current.update({ revokedAt: new Date() }, { transaction });
      return { error: invalid() };
    }
    const user = await Users.findByPk(current.fkUserId, { transaction });
    if (!user || user.status === USER_STATUS.BLOCK) {
      await revokeFamily(current.familyId, transaction);
      return { error: invalid() };
    }
    const next = await issue(user.id, current.familyId, transaction);
    await current.update({ revokedAt: new Date(), replacedById: next.row.id }, { transaction });
    return { refreshToken: next.raw, token: accessTokenFor(user) };
  });
  // Revocations above must commit before we report the failure.
  if (result.error) throw result.error;
  return result;
}

/** Logout: revokes the presented token's whole family (this browser session). */
async function revoke(raw) {
  if (!raw) return;
  const row = await RefreshTokens.findOne({ where: { tokenHash: hash(raw) } });
  if (row) await revokeFamily(row.familyId);
}

/**
 * Staging/production: SameSite=None + Secure, because the portal and the API are on different sites.
 * Development/test: Lax over plain http. COOKIE_* variables override (see config/runtime.js).
 */
function cookieOptions() {
  return {
    httpOnly: true,
    ...cookieSettings(config.get("env"), config.get("cookie")),
    path: "/api/auth",
    maxAge: REFRESH_TTL_MS,
  };
}

/** Same attributes minus maxAge, as res.clearCookie expects. */
function clearCookieOptions() {
  const options = cookieOptions();
  delete options.maxAge;
  return options;
}

module.exports = {
  ROTATION_GRACE_MS,
  clearCookieOptions,
  ACCESS_TOKEN_TTL,
  REFRESH_TTL_MS,
  COOKIE_NAME,
  accessTokenFor,
  issue,
  rotate,
  revoke,
  cookieOptions,
  hash,
};
