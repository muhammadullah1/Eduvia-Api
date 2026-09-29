"use strict";

const express = require("express");
const router = express.Router();
const { attendanceController } = require("../controllers");
const { authorizeRoles } = require("../middlewares/authorize_roles");
const { USER_ROLES, MGMT_ROLES } = require("../constants");
const validate = require("../middlewares/validate");
const { validateList, validateMark } = require("../validations/attendance");

const staff = [...MGMT_ROLES, USER_ROLES.TEACHER];
const all = [...MGMT_ROLES, USER_ROLES.TEACHER, USER_ROLES.PARENT];

router.get("/", authorizeRoles(all), validate(validateList), attendanceController.list);
router.post("/mark", authorizeRoles(staff), validate(validateMark), attendanceController.mark);

module.exports = router;
