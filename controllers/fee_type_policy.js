"use strict";

const feeTypePolicyService = require("../services/fee_type_policy.service");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Fee type policies", (req) => feeTypePolicyService.list(req.user.schoolId)),
  update: handle("Fee type policies updated", (req) => feeTypePolicyService.update(req.user, req.body.items || req.body)),
};
