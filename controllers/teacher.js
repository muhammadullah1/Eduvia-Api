"use strict";

const { teacherService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Teachers", (req) => teacherService.list(req.user.schoolId)),
  getById: handle("Teacher", (req) => teacherService.getById(req.params.id, req.user.schoolId)),
  changeSubject: handle("Teacher subject changed", (req) => teacherService.changeSubject(req.user, req.params.id, req.body)),
  assignClasses: handle("Classes assigned", (req) => teacherService.assignClasses(req.user, req.params.id, req.body.classIds)),
  mySchedule: handle("Schedule", (req) => teacherService.mySchedule(req.user, req.query.date)),
  schedule: handle("Schedule", async (req) =>
    teacherService.scheduleFor(await teacherService.getById(req.params.id, req.user.schoolId), req.query.date),
  ),
};
