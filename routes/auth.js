"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { authController: c } = require("../controllers");
const v = require("../validations/auth");

const router = express.Router();

router.post("/login", validate(v.validateLogin), c.signIn);
router.post("/change-password", authorize("account.self"), validate(v.validateChangePassword), c.updatePassword);
router.post("/forgot-password", validate(v.validateForgotPassword), c.forgotPassword);
router.get("/verify-token", validate(v.validateVerifyToken), c.verifyResetToken);
router.post("/reset-password", validate(v.validateResetPassword), c.resetPassword);

module.exports = router;
