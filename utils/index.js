"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config");

const generateToken = (payload, expiresIn) => {
  return jwt.sign({ ...payload }, config.get("signInJwtSecret"), { expiresIn });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.get("signInJwtSecret"));
    return { valid: true, expired: false, decoded };
  } catch (error) {
    return {
      valid: false,
      expired: error.message.includes("jwt expired"),
      decoded: null,
    };
  }
};

const buildPagination = (items, total, page, pageSize, key = "items") => ({
  [key]: items,
  pagination: {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 0,
  },
});

module.exports = {
  generateToken,
  verifyToken,
  buildPagination,
};
