"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { authController: c } = require("../controllers");
const v = require("../validations/auth");

const router = express.Router();

router.post("/login", validate(v.validateLogin), c.signIn);
router.post("/change-password", authorize("account.self"), validate(v.validateChangePassword), c.updatePassword);

module.exports = router;
