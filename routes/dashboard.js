"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { dashboardController: c } = require("../controllers");
const v = require("../validations/finance");

const router = express.Router();

router.get("/", authorize("reports.dashboard", "fees.collections.mine"), validate(v.validatePeriod), c.dashboard);

module.exports = router;
