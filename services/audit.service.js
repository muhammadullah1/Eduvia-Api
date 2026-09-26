"use strict";

const { AuditLogs } = require("../models");

async function log(schoolId, { actorUserId, actorLabel, action }) {
  return AuditLogs.create({
    fkSchoolId: schoolId,
    actorUserId: actorUserId || null,
    actorLabel,
    action,
    at: new Date(),
  });
}

async function list(schoolId, { limit = 50 } = {}) {
  return AuditLogs.findAll({
    where: { fkSchoolId: schoolId },
    order: [["at", "DESC"]],
    limit: Math.min(Number(limit) || 50, 200),
  });
}

module.exports = { log, list };
