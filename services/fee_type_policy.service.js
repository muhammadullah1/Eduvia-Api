"use strict";

const { FeeTypePolicies, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const { FEE_TYPES } = require("../constants/finance");
const auditService = require("./audit.service");

async function ensureDefaults(schoolId, transaction) {
  for (const feeType of FEE_TYPES) {
    await FeeTypePolicies.findOrCreate({
      where: { fkSchoolId: schoolId, feeType },
      defaults: { concessionEligible: true, active: true, label: feeType },
      transaction,
    });
  }
}

function plain(row) {
  let label = row.label;
  if (!label) label = row.feeType;
  return {
    feeType: row.feeType,
    label,
    concessionEligible: row.concessionEligible,
    active: row.active,
  };
}

async function list(schoolId) {
  await ensureDefaults(schoolId);
  const rows = await FeeTypePolicies.findAll({
    where: { fkSchoolId: schoolId },
    order: [["feeType", "ASC"]],
  });
  return rows.map(plain);
}

async function isEligible(schoolId, feeType, { transaction } = {}) {
  await ensureDefaults(schoolId, transaction);
  const row = await FeeTypePolicies.findOne({ where: { fkSchoolId: schoolId, feeType }, transaction });
  if (!row) return true;
  return Boolean(row.concessionEligible && row.active);
}

async function update(actor, items) {
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, "Provide at least one fee type policy");
  }
  return sequelize.transaction(async (transaction) => {
    await ensureDefaults(actor.schoolId, transaction);
    const out = [];
    for (const item of items) {
      if (!FEE_TYPES.includes(item.feeType)) {
        throw new ApiError(400, `Unknown fee type ${item.feeType}`);
      }
      const row = await FeeTypePolicies.findOne({
        where: { fkSchoolId: actor.schoolId, feeType: item.feeType },
        transaction,
      });
      const patch = {};
      if (item.concessionEligible != null) {
        patch.concessionEligible = Boolean(item.concessionEligible);
      }
      if (item.active != null) {
        patch.active = Boolean(item.active);
      }
      if (item.label != null) {
        patch.label = item.label;
      }
      if (Object.keys(patch).length) {
        await row.update(patch, { transaction });
      }
      out.push(plain(row));
    }
    await auditService.record(
      actor,
      "updated fee type concession policies",
      { entityType: "fee_type_policy", entityId: actor.schoolId, metadata: { items: out } },
      { transaction },
    );
    return out;
  });
}

module.exports = { list, update, isEligible, ensureDefaults };
