"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { attendanceController: c } = require("../controllers");
const v = require("../validations/attendance");

const router = express.Router();

router.get("/", authorize("attendance.read"), validate(v.validateList), c.list);
router.post("/mark", authorize("attendance.mark"), validate(v.validateMark), c.mark);

// Management review (SRS 6.3): Super Admin and Operations Manager only.
const review = authorize("attendance.review");
router.get("/review/today", review, validate(v.validateToday), c.today);
router.get("/review/daily", review, validate(v.validateDaily), c.daily);
router.get("/review/sheet", review, validate(v.validateSheet), c.sheet);
router.get("/review/monthly", review, validate(v.validateMonthly), c.monthly);
router.get("/review/absentees", review, validate(v.validateAbsentees), c.absentees);
router.get("/review/low", review, validate(v.validateLow), c.low);
router.get("/review/changes", review, validate(v.validateHistory), c.history);
router.post("/review/reminders", review, validate(v.validateReminder), c.remind);
router.post("/review/marks", authorize("attendance.edit"), validate(v.validateCreate), c.create);
router.get("/review/super-masters", review, c.superMasters);
router.put("/review/super-masters/:classId", authorize("attendance.edit"), validate(v.validateAssign), c.assignSuperMaster);
// Teacher side: classes this teacher is responsible for today, and reminders routed to them.
router.get("/responsibilities", authorize("attendance.mark"), validate(v.validateToday), c.responsibilities);
router.get("/reminders/mine", authorize("attendance.mark"), c.myReminders);
router.post("/reminders/:id/read", authorize("attendance.mark"), validate(v.validateReminderRead), c.readReminder);
router.patch("/:id", authorize("attendance.edit"), validate(v.validateEdit), c.edit);

module.exports = router;
