"use strict";

const { auditService } = require("../services");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Audit trail", (req) => auditService.list(req.user.schoolId, req.query)),
};
