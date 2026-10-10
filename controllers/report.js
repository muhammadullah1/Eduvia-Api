"use strict";

const { reportService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  dashboard: handle("Dashboard", (req) => reportService.dashboard(req.user)),
};
