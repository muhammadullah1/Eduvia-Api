"use strict";

/**
 * Effective permissions per school role, read from `role_permissions` through an in-process
 * cache keyed by school, invalidated whenever a school's grants change.
 *
 * Invariants that hold whatever is stored: the Super Admin always has the full staff matrix,
 * and nothing outside a role's grantable set is ever honoured (see constants/permissions.js).
 */
const { QueryTypes } = require("sequelize");
const { sequelize, Permissions } = require("../models");
const { USER_ROLES } = require("../constants");
const {
  PERMISSION_CATALOG,
  assertKnownPermission,
  defaultPermissionsFor,
  effectivePermissions,
} = require("../constants/permissions");
const { SYSTEM_ROLES } = require("../constants/roles");

const SUPER_ADMIN_PERMISSIONS = new Set(defaultPermissionsFor(USER_ROLES.SUPER_ADMIN));
const EMPTY = new Set();

const schoolCache = new Map();
const schoolLoads = new Map();
let catalogReady = null;

function catalogRow(entry) {
  return {
    key: entry.key,
    module: entry.module,
    action: entry.action,
    label: entry.label,
    description: entry.description,
    risk: entry.risk,
    assignableRoles: [...new Set([...entry.roles, ...entry.grantableTo])],
  };
}

/** Grants a catalog key new to the database to its default roles in every school. */
async function grantNewKeyToDefaults(entry, transaction) {
  if (!entry.roles.length) return;
  await sequelize.query(
    `INSERT INTO role_permissions (fk_role_id, permission_key, created_at, updated_at)
     SELECT r.id, :key, NOW(), NOW() FROM roles r
      WHERE r.is_system AND r.key IN (:roles)
     ON CONFLICT (fk_role_id, permission_key) DO NOTHING`,
    { replacements: { key: entry.key, roles: entry.roles }, transaction },
  );
}

/**
 * Makes the `permissions` table match the code catalog. Keys new to the catalog are granted to
 * their default roles in every school; keys removed from code are dropped with their grants.
 */
async function syncCatalog() {
  await sequelize.transaction(async (transaction) => {
    const existing = await Permissions.findAll({ attributes: ["key"], raw: true, transaction });
    const existingKeys = new Set(existing.map((row) => row.key));
    const codeKeys = new Set(PERMISSION_CATALOG.map((entry) => entry.key));

    await Permissions.bulkCreate(PERMISSION_CATALOG.map(catalogRow), {
      updateOnDuplicate: ["module", "action", "label", "description", "risk", "assignableRoles", "updatedAt"],
      transaction,
    });
    for (const entry of PERMISSION_CATALOG.filter((item) => !existingKeys.has(item.key))) {
      await grantNewKeyToDefaults(entry, transaction);
    }
    const removed = [...existingKeys].filter((key) => !codeKeys.has(key));
    if (removed.length) await Permissions.destroy({ where: { key: removed }, transaction });
  });
  schoolCache.clear();
}

/** Runs the catalog sync once per process; every permission read waits for it. */
function ready() {
  if (!catalogReady) {
    catalogReady = syncCatalog().catch((error) => {
      catalogReady = null;
      throw error;
    });
  }
  return catalogReady;
}

/** Creates any missing system role (with today's defaults) for a school. Safe under concurrency. */
async function ensureSystemRoles(schoolId, transaction) {
  for (const role of SYSTEM_ROLES) {
    const inserted = await sequelize.query(
      `INSERT INTO roles (fk_school_id, key, label, description, portal, is_system, version, created_at, updated_at)
       VALUES (:schoolId, :key, :label, :description, :portal, true, 1, NOW(), NOW())
       ON CONFLICT (fk_school_id, key) DO NOTHING
       RETURNING id`,
      { replacements: { schoolId, ...role }, type: QueryTypes.SELECT, transaction },
    );
    const created = inserted.find(Boolean);
    if (created) await insertGrants(created.id, defaultPermissionsFor(role.key), null, transaction);
  }
}

async function insertGrants(roleId, keys, grantedByUserId, transaction) {
  if (!keys.length) return;
  await sequelize.query(
    `INSERT INTO role_permissions (fk_role_id, permission_key, fk_granted_by_user_id, created_at, updated_at)
     SELECT :roleId, key, :grantedBy, NOW(), NOW() FROM unnest(ARRAY[:keys]::varchar[]) AS key
     ON CONFLICT (fk_role_id, permission_key) DO NOTHING`,
    { replacements: { roleId, keys, grantedBy: grantedByUserId }, transaction },
  );
}

async function loadSchool(schoolId) {
  await ready();
  await sequelize.transaction((transaction) => ensureSystemRoles(schoolId, transaction));
  const rows = await sequelize.query(
    `SELECT r.key AS role_key, rp.permission_key
       FROM roles r LEFT JOIN role_permissions rp ON rp.fk_role_id = r.id
      WHERE r.fk_school_id = :schoolId`,
    { replacements: { schoolId }, type: QueryTypes.SELECT },
  );
  const stored = new Map();
  for (const row of rows) {
    if (!stored.has(row.role_key)) stored.set(row.role_key, []);
    if (row.permission_key) stored.get(row.role_key).push(row.permission_key);
  }
  const byRole = new Map();
  for (const [roleKey, keys] of stored) byRole.set(roleKey, new Set(effectivePermissions(roleKey, keys)));
  return byRole;
}

/** One in-flight load per school, so a burst of requests after invalidation hits the DB once. */
async function schoolPermissions(schoolId) {
  const cached = schoolCache.get(schoolId);
  if (cached) return cached;
  if (!schoolLoads.has(schoolId)) {
    const load = loadSchool(schoolId)
      .then((byRole) => {
        if (schoolLoads.get(schoolId) === load) schoolCache.set(schoolId, byRole);
        return byRole;
      })
      .finally(() => {
        if (schoolLoads.get(schoolId) === load) schoolLoads.delete(schoolId);
      });
    schoolLoads.set(schoolId, load);
  }
  return schoolLoads.get(schoolId);
}

/** Effective permission keys for a role in a school (a Set; never mutate it). */
async function permissionsFor(schoolId, roleKey) {
  if (roleKey === USER_ROLES.SUPER_ADMIN) return SUPER_ADMIN_PERMISSIONS;
  if (!schoolId) return EMPTY;
  const byRole = await schoolPermissions(schoolId);
  return byRole.get(roleKey) || EMPTY;
}

/** Drops a school's cached grants (call after any change, once the transaction committed). */
function invalidateSchool(schoolId) {
  schoolCache.delete(schoolId);
  schoolLoads.delete(schoolId);
}

/** Capability check on an authenticated actor (`req.user`, which carries `permissions`). */
function hasPermission(actor, key) {
  assertKnownPermission(key);
  return Boolean(actor && actor.permissions && actor.permissions.has(key));
}

module.exports = {
  ready,
  syncCatalog,
  ensureSystemRoles,
  insertGrants,
  permissionsFor,
  invalidateSchool,
  hasPermission,
};
