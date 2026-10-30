"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const userService = require("./user.service");
const emailService = require("./email.service");
const { generateToken, verifyToken } = require("../utils");
const { USER_STATUS } = require("../constants");
const { assertPortalRole, getPortalForRole } = require("../constants/portals");
const ApiError = require("../utils/ApiError");
const refreshTokens = require("./refresh_token.service");
const permissionService = require("./permission.service");

function getResetSecret(user) {
  return `${config.get("signInJwtSecret")}_reset_${user.password || "initial"}`;
}

function getInviteSecret(user) {
  return `${config.get("signInJwtSecret")}_invite_${user.password || "initial"}`;
}

async function findUserForAuth(userId) {
  return userService.findById(userId, {
    attributes: ["id", "fkSchoolId", "role", "status"],
    raw: true,
  });
}

const PRIVATE_USER_FIELDS = ["password", "created_at", "updated_at", "archived_at", "archivedBy"];

function publicUser(user) {
  const json = user.toJSON();
  PRIVATE_USER_FIELDS.forEach((field) => delete json[field]);
  return json;
}

async function effectivePermissionList(user) {
  const held = await permissionService.permissionsFor(user.fkSchoolId, user.role);
  return [...held].sort();
}

/** The signed-in user, their portal and effective permissions (`GET /auth/me`). */
async function session(userId) {
  const user = await userService.findById(userId);
  if (!user) throw new ApiError(401, "Unauthorized. User not found.");
  return { user: publicUser(user), portal: getPortalForRole(user.role), permissions: await effectivePermissionList(user) };
}

async function signIn(email, password, schoolId) {
  const user = await userService.getByEmailWithPassword(
    String(email).trim().toLowerCase(),
    schoolId,
  );
  if (!user || !user.password) {
    throw new ApiError(400, "Invalid email or password");
  }
  if (user.status === USER_STATUS.BLOCK) {
    throw new ApiError(401, "Your account has been blocked or deleted.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid email or password");
  }

  if (!assertPortalRole(user.role)) {
    throw new ApiError(403, "This account cannot sign in to the school portal.");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    await userService.update(user.id, {
      lastLogin: new Date(),
      status: USER_STATUS.ACTIVE,
    });
  } else {
    await userService.update(user.id, { lastLogin: new Date() });
  }

  const token = refreshTokens.accessTokenFor(user);
  const { raw: refreshToken } = await refreshTokens.issue(user.id);

  return {
    user: publicUser(user),
    token,
    refreshToken,
    portal: getPortalForRole(user.role),
    permissions: await effectivePermissionList(user),
  };
}


async function forgotPassword(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userService.getByEmailWithPassword(normalizedEmail);

  if (!user) {
    throw new ApiError(404, "user account not exits")
  }

  const secret = getResetSecret(user);
  const token = jwt.sign(
    { id: user.id, email: user.email, purpose: "password_reset" },
    secret,
    { expiresIn: "1h" },
  );

  const frontEndUrl = config.get("frontEndUrl");
  const resetUrl = `${frontEndUrl}/reset-password?token=${token}`;

  await emailService.sendPasswordResetEmail({
    to: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    resetUrl,
    expiresIn: "1 hour",
  });

  return {
    message: "password reset email have been sent.",
    resetUrl: resetUrl,
  };
}


async function verifyResetToken(token) {
  if (!token) throw new ApiError(400, "Token is required");

  let unverified;
  try {
    unverified = jwt.decode(token);
  } catch {
    throw new ApiError(400, "Malformed token");
  }

  if (!unverified || !unverified.id) {
    throw new ApiError(400, "Invalid reset token");
  }

  const user = await userService.getByIdWithPassword(unverified.id);
  if (!user) {
    throw new ApiError(400, "Account associated with this token was not found");
  }

  const isInvite = unverified.purpose === "invitation";
  const secret = isInvite ? getInviteSecret(user) : getResetSecret(user);

  try {
    const decoded = jwt.verify(token, secret);
    return {
      valid: true,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      purpose: decoded.purpose || "password_reset",
    };
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    throw new ApiError(
      400,
      expired
        ? "This link has expired. Please request a new one."
        : "This link is invalid or has already been used.",
    );
  }
}

async function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  let unverified;
  try {
    unverified = jwt.decode(token);
  } catch {
    throw new ApiError(400, "Malformed token");
  }

  if (!unverified || !unverified.id) {
    throw new ApiError(400, "Invalid token");
  }

  const user = await userService.getByIdWithPassword(unverified.id);
  if (!user) throw new ApiError(404, "User not found");

  const isInvite = unverified.purpose === "invitation";
  const secret = isInvite ? getInviteSecret(user) : getResetSecret(user);

  try {
    jwt.verify(token, secret);
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    throw new ApiError(
      400,
      expired
        ? "This link has expired. Please request a new one."
        : "This link is invalid or has already been used.",
    );
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await userService.update(user.id, {
    password: hashedPassword,
    status: USER_STATUS.ACTIVE,
  });

  return {
    message: isInvite
      ? "Account activated and password set successfully! You can now log in."
      : "Password has been reset successfully! You can now log in.",
  };
}

async function sendUserInvitation(user, role, schoolName) {
  const secret = getInviteSecret(user);
  const token = jwt.sign(
    { id: user.id, email: user.email, purpose: "invitation" },
    secret,
    { expiresIn: "7d" },
  );

  const frontEndUrl = config.get("frontEndUrl");
  const inviteUrl = `${frontEndUrl}/set-password?token=${token}`;

  await emailService.sendInvitationEmail({
    to: user.email,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
    role: role || user.role,
    inviteUrl,
    schoolName: schoolName || "Eduvia",
    expiresIn: "7 days",
  });

  return { token, inviteUrl };
}

module.exports = {
  findUserForAuth,
  signIn,
  session,
  generateToken,
  verifyToken,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  sendUserInvitation,
};
