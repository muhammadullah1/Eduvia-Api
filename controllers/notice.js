"use strict";

const { noticeService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Updates", (req) => noticeService.list(req.user, req.query)),
  create: handle("Update drafted", (req) => noticeService.create(req.user, req.body), 201),
  setStatus: handle("Update status changed", (req) => noticeService.setStatus(req.user, req.params.id, req.body.status)),
  remove: handle("Update deleted", (req) => noticeService.remove(req.user, req.params.id)),
};
