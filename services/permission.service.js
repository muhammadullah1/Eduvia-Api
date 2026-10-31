"use strict";

/**
 * Effective permissions per school role, read from `role_permissions` through an in-process
 * cache keyed by school. Every change to a school's roles or grants bumps that school's row in
 * `school_permission_versions` inside the same transaction; each request compares the cached
 * version with the stored one and reloads on a mismatch, so all API processes (pm2 cluster)
 * see a change on their next request without relying on any message delivery.
 *
 * Invariants that hold whatever is stored: the Super Admin always has the full staff matrix,
 * and nothing outside a role's grantable set is ever honoured (see constants/permissions.js).
 */
const { QueryTypes } = require("sequelize");
const { sequelize, Permissions, AuditLogs } = require("../models");
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
/** A school with no counter row yet; the first bump stores 1. */
const UNVERSIONED = 0;
/** Roles never saved or reset through Roles & Permissions still hold their seeded version. */
const UNCUSTOMISED_ROLE_VERSION = 1;
const SYSTEM_ACTOR = "system";
const ROLE_ENTITY = "role";

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

/** Bumps the permission version of the given schools (call inside the changing transaction). */
async function bumpSchoolVersions(schoolIds, transaction) {
  const ids = [...new Set(schoolIds)];
  if (!ids.length) return;
  await sequelize.query(
    `INSERT INTO school_permission_versions (fk_school_id, version, updated_at)
     SELECT id, 1, NOW() FROM unnest(ARRAY[:ids]::int[]) AS id
     ON CONFLICT (fk_school_id) DO UPDATE
       SET version = school_permission_versions.version + 1, updated_at = NOW()`,
    { replacements: { ids }, transaction },
  );
}

async function bumpAllSchoolVersions(transaction) {
  const rows = await sequelize.query("SELECT DISTINCT fk_school_id FROM roles", { type: QueryTypes.SELECT, transaction });
  await bumpSchoolVersions(rows.map((row) => row.fk_school_id), transaction);
}

async function storedVersion(schoolId) {
  const rows = await sequelize.query("SELECT version FROM school_permission_versions WHERE fk_school_id = :schoolId", {
    replacements: { schoolId },
    type: QueryTypes.SELECT,
  });
  const row = rows.find(Boolean);
  if (!row) return UNVERSIONED;
  return Number(row.version);
}

function systemAudit(schoolId, roleId, action, metadata) {
  return { fkSchoolId: schoolId, fkUserId: null, actorLabel: SYSTEM_ACTOR, action, entityType: ROLE_ENTITY, entityId: roleId, metadata };
}

/**
 * A catalog key new to the database. Its default roles that are still uncustomised (version 1:
 * never saved or reset through Roles & Permissions) receive it; customised roles keep exactly
 * what their school chose and are only told about it. Both outcomes are audited per school.
 */
async function grantNewKeyToDefaults(entry, transaction) {
  if (!entry.roles.length) return;
  const roles = await sequelize.query(
    `SELECT id, fk_school_id, key, label, version FROM roles WHERE is_system AND key IN (:roles)`,
    { replacements: { roles: entry.roles }, type: QueryTypes.SELECT, transaction },
  );
  const uncustomised = roles.filter((role) => Number(role.version) === UNCUSTOMISED_ROLE_VERSION);
  const customised = roles.filter((role) => Number(role.version) !== UNCUSTOMISED_ROLE_VERSION);
  const granted = [];
  if (uncustomised.length) {
    const inserted = await sequelize.query(
      `INSERT INTO role_permissions (fk_role_id, permission_key, created_at, updated_at)
       SELECT id, :key, NOW(), NOW() FROM unnest(ARRAY[:ids]::int[]) AS id
       ON CONFLICT (fk_role_id, permission_key) DO NOTHING
       RETURNING fk_role_id`,
      { replacements: { key: entry.key, ids: uncustomised.map((role) => role.id) }, type: QueryTypes.SELECT, transaction },
    );
    const insertedIds = new Set(inserted.map((row) => row.fk_role_id));
    granted.push(...uncustomised.filter((role) => insertedIds.has(role.id)));
  }
  const metadata = (role) => ({ roleKey: role.key, roleLabel: role.label, permissionKey: entry.key, added: [entry.key], removed: [] });
  const audits = [
    ...granted.map((role) => systemAudit(role.fk_school_id, role.id, `granted new permission ${entry.key} to ${role.label}`, metadata(role))),
    ...customised.map((role) =>
      systemAudit(role.fk_school_id, role.id, `new permission ${entry.key} not granted to customised ${role.label}`, {
        ...metadata(role),
        added: [],
      }),
    ),
  ];
  if (audits.length) await AuditLogs.bulkCreate(audits, { transaction });
  await bumpSchoolVersions(granted.map((role) => role.fk_school_id), transaction);
}

/**
 * Makes the `permissions` table match the code catalog. Keys new to the catalog are granted to
 * their uncustomised default roles (see grantNewKeyToDefaults); keys removed from code are
 * dropped with their grants.
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
    if (removed.length) {
      await Permissions.destroy({ where: { key: removed }, transaction });
      await bumpAllSchoolVersions(transaction);
    }
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
  let created = false;
  for (const role of SYSTEM_ROLES) {
    const inserted = await sequelize.query(
      `INSERT INTO roles (fk_school_id, key, label, description, portal, is_system, version, created_at, updated_at)
       VALUES (:schoolId, :key, :label, :description, :portal, true, 1, NOW(), NOW())
       ON CONFLICT (fk_school_id, key) DO NOTHING
       RETURNING id`,
      { replacements: { schoolId, ...role }, type: QueryTypes.SELECT, transaction },
    );
    const row = inserted.find(Boolean);
    if (row) {
      await insertGrants(row.id, defaultPermissionsFor(role.key), null, transaction);
      created = true;
    }
  }
  if (created) await bumpSchoolVersions([schoolId], transaction);
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

/**
 * The school's grants at its current stored version. The version is read before the grants, so a
 * change committed during a load leaves the cache one version behind and the next request reloads.
 * One in-flight load per school and version, so a burst of requests hits the DB once.
 */
async function schoolPermissions(schoolId) {
  await ready();
  const version = await storedVersion(schoolId);
  const cached = schoolCache.get(schoolId);
  if (cached && cached.version === version) return cached.byRole;
  const pending = schoolLoads.get(schoolId);
  if (pending && pending.version === version) return pending.load;
  const load = loadSchool(schoolId)
    .then((byRole) => {
      const current = schoolCache.get(schoolId);
      if (!current || current.version <= version) schoolCache.set(schoolId, { version, byRole });
      return byRole;
    })
    .finally(() => {
      const entry = schoolLoads.get(schoolId);
      if (entry && entry.load === load) schoolLoads.delete(schoolId);
    });
  schoolLoads.set(schoolId, { version, load });
  return load;
}

/** Effective permission keys for a role in a school (a Set; never mutate it). */
async function permissionsFor(schoolId, roleKey) {
  if (roleKey === USER_ROLES.SUPER_ADMIN) return SUPER_ADMIN_PERMISSIONS;
  if (!schoolId) return EMPTY;
  const byRole = await schoolPermissions(schoolId);
  return byRole.get(roleKey) || EMPTY;
}

/**
 * Drops this process's cached grants for a school. Other processes catch up through the stored
 * version; this only saves the changing process one stale-version round trip.
 */
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
  bumpSchoolVersions,
  grantNewKeyToDefaults,
  UNCUSTOMISED_ROLE_VERSION,
  permissionsFor,
  invalidateSchool,
  hasPermission,
};
