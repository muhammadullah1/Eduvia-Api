"use strict";

const { Op } = require("sequelize");
const { SchoolConcessionReasons, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { CONCESSION_MODES } = require("../constants/concessions");

function plain(row) {
  let defaultValue = null;
  if (row.defaultValue != null) defaultValue = Number(row.defaultValue);
  return {
    id: row.id,
    schoolId: row.fkSchoolId,
    label: row.label,
    defaultMode: row.defaultMode,
    defaultValue,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

const SEED = [
  { label: "Sibling", sortOrder: 10, defaultMode: "percent", defaultValue: 10 },
  { label: "Staff child", sortOrder: 20, defaultMode: "percent", defaultValue: 50 },
  { label: "Merit", sortOrder: 30, defaultMode: "percent", defaultValue: 25 },
  { label: "Hardship", sortOrder: 40, defaultMode: "fixed_discount", defaultValue: null },
  { label: "Orphan", sortOrder: 50, defaultMode: "waiver", defaultValue: 0 },
];

async function ensureSeeded(schoolId, transaction) {
  const n = await SchoolConcessionReasons.count({
    where: { fkSchoolId: schoolId },
    transaction,
  });
  if (n > 0) return;
  for (const row of SEED) {
    await SchoolConcessionReasons.create(
      {
        fkSchoolId: schoolId,
        label: row.label,
        defaultMode: row.defaultMode,
        defaultValue: row.defaultValue,
        sortOrder: row.sortOrder,
        active: true,
      },
      { transaction },
    );
  }
}

async function list(schoolId, { includeInactive = false } = {}) {
  await ensureSeeded(schoolId);
  const where = { fkSchoolId: schoolId };
  if (!includeInactive) where.active = true;
  const rows = await SchoolConcessionReasons.findAll({
    where,
    order: [
      ["sortOrder", "ASC"],
      ["label", "ASC"],
    ],
  });
  return rows.map(plain);
}

async function create(actor, body) {
  return sequelize.transaction(async (transaction) => {
    const label = String(body.label || "").trim();
    if (!label) throw new ApiError(400, "Reason label is required");

    let defaultMode = null;
    if (body.defaultMode) {
      if (!CONCESSION_MODES.includes(body.defaultMode)) {
        throw new ApiError(400, "Invalid default type");
      }
      defaultMode = body.defaultMode;
    }

    let defaultValue = null;
    if (body.defaultValue != null && body.defaultValue !== "") {
      defaultValue = Number(body.defaultValue);
    }

    const dup = await SchoolConcessionReasons.findOne({
      where: {
        fkSchoolId: actor.schoolId,
        label: { [Op.iLike]: label },
      },
      transaction,
    });
    if (dup) throw new ApiError(409, "A reason with this label already exists");

    const row = await SchoolConcessionReasons.create(
      {
        fkSchoolId: actor.schoolId,
        label,
        defaultMode,
        defaultValue,
        sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 100,
        active: body.active !== false,
      },
      { transaction },
    );
    await auditService.record(
      actor,
      `added concession reason "${label}"`,
      { entityType: "concession_reason", entityId: row.id },
      { transaction },
    );
    return plain(row);
  });
}

async function update(actor, id, body) {
  return sequelize.transaction(async (transaction) => {
    const row = await SchoolConcessionReasons.findOne({
      where: { id, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!row) throw new ApiError(404, "Reason not found");

    const patch = {};
    if (body.label != null) {
      const label = String(body.label).trim();
      if (!label) throw new ApiError(400, "Reason label is required");
      const dup = await SchoolConcessionReasons.findOne({
        where: {
          fkSchoolId: actor.schoolId,
          label: { [Op.iLike]: label },
          id: { [Op.ne]: id },
        },
        transaction,
      });
      if (dup) throw new ApiError(409, "A reason with this label already exists");
      patch.label = label;
    }
    if (body.defaultMode !== undefined) {
      if (body.defaultMode === null || body.defaultMode === "") {
        patch.defaultMode = null;
      } else if (!CONCESSION_MODES.includes(body.defaultMode)) {
        throw new ApiError(400, "Invalid default type");
      } else {
        patch.defaultMode = body.defaultMode;
      }
    }
    if (body.defaultValue !== undefined) {
      if (body.defaultValue === null || body.defaultValue === "") {
        patch.defaultValue = null;
      } else {
        patch.defaultValue = Number(body.defaultValue);
      }
    }
    if (body.sortOrder != null) patch.sortOrder = Number(body.sortOrder);
    if (body.active != null) patch.active = Boolean(body.active);

    await row.update(patch, { transaction });
    await auditService.record(
      actor,
      `updated concession reason #${row.id}`,
      { entityType: "concession_reason", entityId: row.id, metadata: patch },
      { transaction },
    );
    return plain(row);
  });
}

async function remove(actor, id) {
  return sequelize.transaction(async (transaction) => {
    const row = await SchoolConcessionReasons.findOne({
      where: { id, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!row) throw new ApiError(404, "Reason not found");
    await row.destroy({ transaction });
    await auditService.record(
      actor,
      `archived concession reason "${row.label}"`,
      { entityType: "concession_reason", entityId: row.id },
      { transaction },
    );
    return { id: row.id, archived: true };
  });
}

module.exports = { list, create, update, remove, plain, ensureSeeded };
