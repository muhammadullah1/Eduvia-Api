"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { schoolController: c } = require("../controllers");
const v = require("../validations/school");

const router = express.Router();

router.get("/current", authorize("school.read"), c.getCurrent);
router.patch("/current", authorize("school.update"), validate(v.validateUpdate), c.update);

module.exports = router;
