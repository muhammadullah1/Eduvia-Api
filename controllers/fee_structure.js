"use strict";

const feeStructureService = require("../services/fee_structure.service");
const { handle } = require("../utils/handler");

module.exports = {
  get: handle("Fee structure", (req) => feeStructureService.forClass(req.user.schoolId, req.params.classId, req.query)),
  history: handle("Fee history", (req) => feeStructureService.history(req.user.schoolId, req.params.classId, req.params.feeType)),
  add: handle("Fee added", (req) => feeStructureService.add(req.user, req.params.classId, req.body), 201),
  remove: handle("Fee type removed", (req) => feeStructureService.remove(req.user, req.params.classId, req.params.feeType, req.body.reason)),
};
