"use strict";

const { dailyTestService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  listSchedules: handle("Weekly test schedules", (req) => dailyTestService.listSchedules(req.user.schoolId, req.query)),
  saveSchedule: handle("Weekly test day saved", (req) => dailyTestService.saveSchedule(req.user, req.body)),
  deactivateSchedule: handle("Schedule removed", (req) => dailyTestService.deactivateSchedule(req.user, req.params.id)),
  generateMonth: handle("Tests generated", (req) => dailyTestService.generateMonth(req.user, req.body), 201),
  list: handle("Weekly tests", (req) => dailyTestService.list(req.user, req.query)),
  getById: handle("Weekly test", (req) => dailyTestService.getForStaff(req.user, req.params.id)),
  saveMarks: handle("Marks saved", (req) => dailyTestService.saveMarks(req.user, req.params.id, req.body.marks)),
  publish: handle("Marks published", (req) => dailyTestService.publish(req.user, req.params.id)),
  monthlySummary: handle("Monthly subject summary", (req) => dailyTestService.monthlySummary(req.user, req.query)),
  flagged: handle("Flagged for follow-up", (req) => dailyTestService.flagged(req.user, req.query)),
};
