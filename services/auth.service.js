"use strict";

const bcrypt = require("bcryptjs");
const userService = require("./user.service");
const { generateToken, verifyToken } = require("../utils");
const { USER_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");

async function findUserForAuth(userId) {
  return userService.findById(userId, {
    attributes: ["id", "fkSchoolId", "role", "status"],
    raw: true,
  });
}

async function signIn(email, password) {
  const user = await userService.getByEmailWithPassword(email);
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

  if (user.status !== USER_STATUS.ACTIVE) {
    await userService.update(user.id, {
      lastLogin: new Date(),
      status: USER_STATUS.ACTIVE,
    });
  } else {
    await userService.update(user.id, { lastLogin: new Date() });
  }

  const userJson = user.toJSON();
  delete userJson.password;
  delete userJson.created_at;
  delete userJson.updated_at;
  delete userJson.archived_at;
  delete userJson.archivedBy;

  const token = generateToken(
    {
      id: user.id,
      schoolId: user.fkSchoolId,
      role: user.role,
      email: user.email,
    },
    "1d",
  );

  return { user: userJson, token };
}

module.exports = {
  findUserForAuth,
  signIn,
  generateToken,
  verifyToken,
};
