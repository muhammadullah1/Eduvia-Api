"use strict";

const { AuditLogs, sequelize } = require("../models");

async function log(schoolId, { actorUserId, actorLabel, action, entityType, entityId, metadata }, options = {}) {
  return AuditLogs.create(
    {
      fkSchoolId: schoolId,
      actorUserId: actorUserId || null,
      actorLabel: actorLabel || "system",
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      metadata: metadata || null,
      at: new Date(),
    },
    options,
  );
}

/** Audit an action taken by the authenticated user (req.user). */
async function record(actor, action, { entityType, entityId, metadata } = {}, options = {}) {
  return log(
    actor.schoolId,
    {
      actorUserId: actor.id,
      actorLabel: `${actor.email || "user"} (${actor.role})`,
      action,
      entityType,
      entityId,
      metadata,
    },
    options,
  );
}

async function list(schoolId, { limit = 50, entityType, entityId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  return AuditLogs.findAll({
    where,
    order: [[sequelize.literal("created_at"), "DESC"]],
    limit: Math.min(Number(limit) || 50, 200),
  });
}

module.exports = { log, record, list };
