"use strict";

const concessionReasonService = require("../services/concession_reason.service");
const { handle } = require("../utils/handler");

module.exports = {
  list: handle("Concession reasons", async (req) =>
    concessionReasonService.list(req.user.schoolId, {
      includeInactive: req.query.includeInactive === "1",
    }),
  ),
  create: handle("Concession reason created", async (req) =>
    concessionReasonService.create(req.user, req.body),
  201),
  update: handle("Concession reason updated", async (req) =>
    concessionReasonService.update(req.user, req.params.id, req.body),
  ),
  remove: handle("Concession reason archived", async (req) =>
    concessionReasonService.remove(req.user, req.params.id),
  ),
};
