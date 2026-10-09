"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { auditController: c } = require("../controllers");
const v = require("../validations/audit");

const router = express.Router();

router.get("/", authorize("audit.read"), validate(v.validateList), c.list);

module.exports = router;
