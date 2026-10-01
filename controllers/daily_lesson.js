"use strict";

const { dailyLessonService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Daily updates", (req) => dailyLessonService.list(req.user, req.query)),
  create: handle("Daily update submitted", (req) => dailyLessonService.create(req.user, req.body), 201),
  update: handle("Daily update saved", (req) => dailyLessonService.update(req.user, req.params.id, req.body)),
  review: handle("Daily update reviewed", (req) => dailyLessonService.review(req.user, req.params.id, req.body)),
  remove: handle("Daily update removed", (req) => dailyLessonService.remove(req.user, req.params.id)),
};
