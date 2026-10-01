"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { dailyLessonController: c } = require("../controllers");
const v = require("../validations/daily_lesson");

const router = express.Router();

router.get("/", authorize("lessons.read"), validate(v.validateList), c.list);
router.post("/", authorize("lessons.write"), validate(v.validateCreate), c.create);
router.patch("/:id", authorize("lessons.write"), validate(v.validateUpdate), c.update);
router.post("/:id/review", authorize("lessons.review"), validate(v.validateReview), c.review);
router.delete("/:id", authorize("lessons.review"), validate(v.validateId), c.remove);

module.exports = router;
