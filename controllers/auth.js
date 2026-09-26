"use strict";

const bcrypt = require("bcryptjs");
const { authService, userService } = require("../services");
const ApiError = require("../utils/ApiError");

async function signIn(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.signIn(email, password);
    return res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: { user, token },
    });
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

module.exports = { signIn, updatePassword };
