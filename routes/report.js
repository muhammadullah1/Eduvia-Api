"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const { reportController: c } = require("../controllers");

const router = express.Router();

router.get("/dashboard", authorize("reports.dashboard"), c.dashboard);

module.exports = router;
