"use strict";

const { timetableService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Timetable", (req) => timetableService.listByClass(req.user, req.query.classId)),
  create: handle("Timetable slot created", (req) => timetableService.create(req.user.schoolId, req.body), 201),
  update: handle("Timetable slot updated", (req) => timetableService.update(req.params.id, req.user.schoolId, req.body)),
  remove: handle("Timetable slot removed", (req) => timetableService.remove(req.params.id, req.user.schoolId)),
};
