"use strict";

const { Op } = require("sequelize");
const { AuditLogs, sequelize } = require("../models");
const { hasPermission } = require("./permission.service");

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

/** Audit entries about money; hidden from roles without fee access (Ops reads the rest). */
const FEE_ENTITY_TYPES = ["fee_payment", "student_fee_month", "expense", "fee_structure", "other_income", "fee_import", "student_credit", "finance_report"];

async function list(schoolId, { limit = 50, entityType, entityId } = {}, viewer = null) {
  const where = { fkSchoolId: schoolId };
  const feeBlind = viewer && !hasPermission(viewer, "fees.amounts.read");
  if (feeBlind && FEE_ENTITY_TYPES.includes(entityType)) return [];
  if (entityType) where.entityType = entityType;
  else if (feeBlind) where[Op.or] = [{ entityType: null }, { entityType: { [Op.notIn]: FEE_ENTITY_TYPES } }];
  if (entityId) where.entityId = entityId;
  return AuditLogs.findAll({
    where,
    order: [[sequelize.literal("created_at"), "DESC"]],
    limit: Math.min(Number(limit) || 50, 200),
  });
}

module.exports = { log, record, list, FEE_ENTITY_TYPES };
