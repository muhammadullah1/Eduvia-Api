"use strict";

const authService = require("../services/auth.service");
const permissionService = require("../services/permission.service");
const ApiError = require("../utils/ApiError");

const BEARER = "Bearer ";
const EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER)) {
    throw new ApiError(401, "Unauthorized. No token provided.");
  }
  return header.slice(BEARER.length);
}

function tokenError(expired) {
  if (expired) return new ApiError(401, EXPIRED_MESSAGE);
  return new ApiError(401, "Invalid token");
}

/**
 * Loads the signed-in user from the database on every request (role and status changes
 * apply at once) and attaches `req.user` with the role's effective permissions.
 */
async function authenticate(req) {
  const { valid, expired, decoded } = authService.verifyToken(bearerToken(req));
  if (!valid) throw tokenError(expired);

  const user = await authService.findUserForAuth(decoded.id || decoded.userId);
  if (!user) throw new ApiError(401, "Unauthorized. User not found.");
  if (user.status === "block") throw new ApiError(401, "Access Denied. Account deleted or blocked.");

  req.user = {
    id: user.id,
    schoolId: user.fkSchoolId,
    role: user.role,
    email: decoded.email,
    permissions: await permissionService.permissionsFor(user.fkSchoolId, user.role),
  };
  return req.user;
}

module.exports = { authenticate };
