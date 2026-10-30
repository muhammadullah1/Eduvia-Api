"use strict";

const bcrypt = require("bcryptjs");
const { authService, userService } = require("../services");
const storageService = require("../services/storage.service");
const uploadPolicy = require("../services/upload_policy.service");
const refreshTokens = require("../services/refresh_token.service");
const ApiError = require("../utils/ApiError");

async function signIn(req, res, next) {
  try {
    const { email, password, schoolId } = req.body;
    const { user, token, refreshToken, portal, permissions } = await authService.signIn(email, password, schoolId);
    res.cookie(refreshTokens.COOKIE_NAME, refreshToken, refreshTokens.cookieOptions());
    return res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: { user, token, portal, permissions },
    });
  } catch (err) {
    next(err);
  }
}

/** The signed-in user with their portal and effective permissions. */
async function me(req, res, next) {
  try {
    const data = await authService.session(req.user.id);
    res.status(200).json({ success: true, message: "Session", data });
  } catch (err) {
    next(err);
  }
}

/** Rotates the refresh cookie and returns a fresh short-lived access token. */
async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.[refreshTokens.COOKIE_NAME];
    const { token, refreshToken } = await refreshTokens.rotate(raw);
    res.cookie(refreshTokens.COOKIE_NAME, refreshToken, refreshTokens.cookieOptions());
    res.status(200).json({ success: true, message: "Session refreshed", data: { token } });
  } catch (err) {
    res.clearCookie(refreshTokens.COOKIE_NAME, refreshTokens.clearCookieOptions());
    next(err);
  }
}

/** Revokes this browser's refresh family and clears the cookie (works with an expired access token). */
async function logout(req, res, next) {
  try {
    await refreshTokens.revoke(req.cookies?.[refreshTokens.COOKIE_NAME]);
    res.clearCookie(refreshTokens.COOKIE_NAME, refreshTokens.clearCookieOptions());
    res.status(200).json({ success: true, message: "Signed out" });
  } catch (err) {
    next(err);
  }
}

/** Signs a direct-to-R2 upload once the folder, name and type are allowed. */
async function getPresignedUrl(req, res, next) {
  try {
    await uploadPolicy.assertCanUpload(req.user, req.body);
    const data = await storageService.presignUpload(req.body);
    res.status(200).json({ success: true, message: "Upload URL created", data });
  } catch (err) {
    next(err);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters long");
    }

    const user = await userService.getByIdWithPassword(userId);
    if (!user) throw new ApiError(404, "User not found");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await userService.update(userId, { password: hashedPassword, status: "active" });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function verifyResetToken(req, res, next) {
  try {
    const { token } = req.query;
    const result = await authService.verifyResetToken(token);
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signIn,
  me,
  refresh,
  logout,
  updatePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  getPresignedUrl,
};
