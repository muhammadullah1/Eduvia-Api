"use strict";

const { attendanceService, attendanceReviewService: review, accessService, superMasterService: superMaster } = require("../services");
const { today: schoolToday } = require("../utils/dates");
const { handle } = require("../utils/handler");
const attendanceSheet = require("../services/attendance_sheet.service");
const { sendFile } = require("../utils/report_export");

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
    // Teacher-side attendance belongs to the class's Super Master (or that day's substitute) only.
    await superMaster.assertCanMark(req.user, req.body.classId, req.body.date || schoolToday());
    return attendanceService.markMany(req.user.schoolId, req.body, req.user);
  }),
  today: handle("Today's attendance", (req) => review.todayStatus(req.user.schoolId, req.query)),
  daily: handle("Daily attendance", (req) => review.daily(req.user.schoolId, req.query, req.user)),
  sheet: async (req, res, next) => {
    try {
      const { buffer, format, filename } = await attendanceSheet.render(req.user, req.query);
      return sendFile(res, buffer, format, filename);
    } catch (err) {
      return next(err);
    }
  },
  monthly: handle("Monthly attendance", (req) => review.monthly(req.user.schoolId, req.query)),
  absentees: handle("Absentees", (req) => review.absentees(req.user.schoolId, req.query)),
  low: handle("Low attendance", (req) => review.lowAttendance(req.user.schoolId, req.query)),
  history: handle("Attendance changes", (req) => review.history(req.user.schoolId, req.query)),
  edit: handle("Attendance updated", (req) => review.edit(req.user, Number(req.params.id), req.body)),
  create: handle("Attendance created", (req) => review.create(req.user, req.body), 201),
  superMasters: handle("Super Masters", (req) => superMaster.overview(req.user.schoolId)),
  assignSuperMaster: handle("Super Master updated", (req) => superMaster.assign(req.user, Number(req.params.classId), req.body.teacherId)),
  responsibilities: handle("Attendance responsibilities", (req) => superMaster.classesFor(req.user, req.query.date || schoolToday())),
  myReminders: handle("Attendance reminders", (req) => superMaster.remindersFor(req.user)),
  readReminder: handle("Reminder read", (req) => superMaster.markReminderRead(req.user, Number(req.params.id))),
  remind: handle("Reminder sent", (req) => review.remind(req.user, req.body), 201),
};
