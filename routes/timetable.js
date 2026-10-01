"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { timetableController: c } = require("../controllers");
const v = require("../validations/timetable");

const router = express.Router();
const manage = authorize("timetable.manage");

router.get("/", authorize("timetable.read"), validate(v.validateList), c.list);
router.post("/", manage, validate(v.validateCreate), c.create);
router.patch("/:id", manage, validate(v.validateUpdate), c.update);
router.delete("/:id", manage, validate(v.validateId), c.remove);

module.exports = router;
