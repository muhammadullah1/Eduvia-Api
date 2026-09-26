"use strict";

const express = require("express");
const platformMiddleware = require("../middlewares/plateform");
const authRouter = require("./auth");
const schoolRouter = require("./school");
const userRouter = require("./user");
const sessionRouter = require("./session");
const classRouter = require("./class");
const subjectRouter = require("./subject");
const teacherRouter = require("./teacher");
const studentRouter = require("./student");
const parentRouter = require("./parent");
const applicationRouter = require("./application");
const attendanceRouter = require("./attendance");
const feeRouter = require("./fee");
const examRouter = require("./exam");
const timetableRouter = require("./timetable");

const router = express.Router();

router.use(platformMiddleware);
router.use("/auth", authRouter);
router.use("/schools", schoolRouter);
router.use("/users", userRouter);
router.use("/sessions", sessionRouter);
router.use("/classes", classRouter);
router.use("/subjects", subjectRouter);
router.use("/teachers", teacherRouter);
router.use("/students", studentRouter);
router.use("/parents", parentRouter);
router.use("/applications", applicationRouter);
router.use("/attendances", attendanceRouter);
router.use("/fees", feeRouter);
router.use("/exams", examRouter);
router.use("/timetable", timetableRouter);

module.exports = router;
