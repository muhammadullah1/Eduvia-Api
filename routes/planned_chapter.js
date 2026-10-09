"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { plannedChapterController: c } = require("../controllers");
const v = require("../validations/planned_chapter");

const router = express.Router();
const manage = authorize("chapters.manage");

router.get("/", authorize("chapters.read"), validate(v.validateList), c.list);
router.post("/", manage, validate(v.validateCreate), c.create);
router.patch("/:id", manage, validate(v.validateUpdate), c.update);
router.delete("/:id", manage, validate(v.validateId), c.remove);

module.exports = router;
