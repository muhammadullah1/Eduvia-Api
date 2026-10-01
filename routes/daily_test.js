"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { dailyTestController: c } = require("../controllers");
const v = require("../validations/daily_test");

const router = express.Router();
const schedule = authorize("tests.schedule");

router.get("/schedules", authorize("tests.read"), validate(v.validateScheduleList), c.listSchedules);
router.put("/schedules", schedule, validate(v.validateSchedule), c.saveSchedule);
router.delete("/schedules/:id", schedule, validate(v.validateId), c.deactivateSchedule);
router.post("/generate", schedule, validate(v.validateGenerate), c.generateMonth);
router.get("/monthly-summary", authorize("tests.read"), validate(v.validateSummary), c.monthlySummary);
router.get("/flagged", schedule, validate(v.validateFlagged), c.flagged);
router.get("/", authorize("tests.read"), validate(v.validateList), c.list);
router.get("/:id", authorize("tests.marks"), validate(v.validateId), c.getById);
router.put("/:id/marks", authorize("tests.marks"), validate(v.validateMarks), c.saveMarks);
router.post("/:id/publish", authorize("tests.publish"), validate(v.validateId), c.publish);

module.exports = router;
