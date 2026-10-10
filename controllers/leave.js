"use strict";

const { leaveService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Leave requests", (req) => leaveService.list(req.user, req.query)),
  create: handle("Leave request submitted", (req) => leaveService.create(req.user, req.body), 201),
  review: handle("Leave request reviewed", (req) => leaveService.review(req.user, req.params.id, req.body)),
};
