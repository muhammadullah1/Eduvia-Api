"use strict";

const express = require("express");
const router = express.Router();
const { authController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES, FEE_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateLogin, validateChangePassword } = require("../validations/auth");

router.post("/login", validate(validateLogin), authController.signIn);
router.post(
  "/change-password",
  authorizeRoles([...MGMT_ROLES, USER_ROLES.ACCOUNTANT, USER_ROLES.TEACHER, USER_ROLES.PARENT]),
  validate(validateChangePassword),
  authController.updatePassword,
);

module.exports = router;
