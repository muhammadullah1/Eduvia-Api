"use strict";

const feeAdjustmentService = require("../services/fee_adjustment.service");
const { handle } = require("../utils/handler");

module.exports = {
  request: handle("Adjustment requested", (req) => feeAdjustmentService.request(req.user, req.params.id, req.body), 201),
  approve: handle("Adjustment approved", (req) => feeAdjustmentService.approve(req.user, req.params.id)),
  reject: handle("Adjustment rejected", (req) => feeAdjustmentService.reject(req.user, req.params.id, req.body.reason)),
};
