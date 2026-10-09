"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { settingsController: c } = require("../controllers");
const v = require("../validations/settings");

const router = express.Router();

router.get("/", authorize("settings.read"), c.getAll);
router.put("/:key", authorize("settings.read"), validate(v.validateUpdate), c.update);

module.exports = router;
