"use strict";

const { dashboardService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  dashboard: handle("Dashboard", (req) => dashboardService.dashboard(req.user, req.query)),
};
