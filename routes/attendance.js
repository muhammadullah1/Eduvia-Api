"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { attendanceController: c } = require("../controllers");
const v = require("../validations/attendance");

const router = express.Router();

router.get("/", authorize("attendance.read"), validate(v.validateList), c.list);
router.post("/mark", authorize("attendance.mark"), validate(v.validateMark), c.mark);

module.exports = router;
