"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const c = require("../controllers/report");
const v = require("../validations/report");

/** Management and student reports (SRS 8). Fee and finance reports live under /fees and /finance. */
const router = express.Router();

router.get("/students/:kind", authorize("students.manage"), validate(v.validateStudentReport), c.studentReport);

module.exports = router;
