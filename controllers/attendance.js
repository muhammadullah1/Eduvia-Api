"use strict";

const { attendanceService } = require("../services");

module.exports = {
  list: async (req, res, next) => {
    try {
      const { classId, date } = req.query;
      const data = await attendanceService.listByClassDate(
        req.user.schoolId,
        classId,
        date,
      );
      res.status(200).json({ success: true, message: "Attendance", data });
    } catch (err) {
      next(err);
    }
  },
  mark: async (req, res, next) => {
    try {
      const data = await attendanceService.markMany(req.user.schoolId, req.body);
      res.status(200).json({ success: true, message: "Attendance marked", data });
    } catch (err) {
      next(err);
    }
  },
};
