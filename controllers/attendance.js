"use strict";

const { attendanceService, accessService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Attendance", async (req) => {
    const { classId, date } = req.query;
    if (classId) {
      await accessService.assertTeacherClass(req.user, classId, date);
      await accessService.assertClassVisible(req.user, classId);
    }
    const studentIds = await accessService.studentScope(req.user);
    return attendanceService.listByClassDate(req.user.schoolId, classId, date, studentIds);
  }),
  mark: handle("Attendance marked", async (req) => {
    await accessService.assertTeacherClass(req.user, req.body.classId, req.body.date);
    return attendanceService.markMany(req.user.schoolId, req.body, req.user);
  }),
};
