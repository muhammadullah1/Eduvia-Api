"use strict";

const express = require("express");
const { authorize } = require("../middlewares/authorize");
const validate = require("../middlewares/validate");
const { teacherController: c } = require("../controllers");
const v = require("../validations/teacher");

const router = express.Router();
const manage = authorize("teachers.manage");

router.get("/me/schedule", authorize("teachers.self"), validate(v.validateSchedule), c.mySchedule);
router.get("/", authorize("teachers.read"), c.list);
router.get("/:id", authorize("teachers.read"), validate(v.validateId), c.getById);
router.get("/:id/schedule", manage, validate(v.validateTeacherSchedule), c.schedule);
router.put("/:id/subject", manage, validate(v.validateChangeSubject), c.changeSubject);
router.put("/:id/classes", manage, validate(v.validateAssignClasses), c.assignClasses);

module.exports = router;
