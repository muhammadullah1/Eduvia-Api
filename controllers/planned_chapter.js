"use strict";

const { plannedChapterService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Planned chapters", (req) => plannedChapterService.list(req.user.schoolId, req.query)),
  create: handle("Planned chapter created", (req) => plannedChapterService.create(req.user, req.body), 201),
  update: handle("Planned chapter updated", (req) => plannedChapterService.update(req.user, req.params.id, req.body)),
  remove: handle("Planned chapter removed", (req) => plannedChapterService.remove(req.user, req.params.id)),
};
