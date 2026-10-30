"use strict";

/**
 * Roles & Permissions (per school). Grants change only inside the role's grantable set; locked
 * keys explain why. Every change is versioned (optimistic lock), audited and invalidates the
 * school's permission cache once committed.
 */
const { Op, QueryTypes } = require("sequelize");
const { sequelize, Roles, RolePermissions, Users } = require("../models");
const { USER_ROLES, USER_STATUS } = require("../constants");
const {
  ACTIONS,
  PERMISSION_MODULES,
  PERMISSION_CATALOG,
  ALWAYS_GRANTED,
  defaultPermissionsFor,
  effectivePermissions,
  lockReasonFor,
} = require("../constants/permissions");
const { STAFF_PORTAL_ROLES, SYSTEM_ROLES } = require("../constants/roles");
const permissionService = require("./permission.service");
const auditService = require("./audit.service");
const ApiError = require("../utils/ApiError");

const ROLE_ENTITY = "role";
const USER_ROLE_ENTITY = "user_role";
const ROLE_LABELS = new Map(SYSTEM_ROLES.map((role) => [role.key, role.label]));

function catalog() {
  return {
    actions: Object.values(ACTIONS),
    modules: PERMISSION_MODULES,
    permissions: PERMISSION_CATALOG.map(({ key, module, action, label, description, risk }) => ({
      key,
      module,
      action,
      label,
      description,
      risk,
    })),
  };
}

async function ensureRoles(schoolId) {
  await sequelize.transaction((transaction) => permissionService.ensureSystemRoles(schoolId, transaction));
}

async function activeUserCounts(schoolId) {
  const rows = await sequelize.query(
    `SELECT role, COUNT(*)::int AS total FROM users
      WHERE fk_school_id = :schoolId AND status = :active GROUP BY role`,
    { replacements: { schoolId, active: USER_STATUS.ACTIVE }, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((row) => [row.role, row.total]));
}

async function storedKeys(roleId, transaction) {
  const rows = await RolePermissions.findAll({
    where: { fkRoleId: roleId },
    attributes: ["permissionKey"],
    raw: true,
    transaction,
  });
  return rows.map((row) => row.permissionKey);
}

function roleSummary(role, userCount, permissionCount) {
  return {
    id: role.id,
    key: role.key,
    label: role.label,
    description: role.description,
    portal: role.portal,
    isSystem: role.isSystem,
    version: role.version,
    userCount,
    permissionCount,
  };
}

async function list(schoolId) {
  await ensureRoles(schoolId);
  const roles = await Roles.findAll({ where: { fkSchoolId: schoolId }, order: [["id", "ASC"]] });
  const counts = await activeUserCounts(schoolId);
  const result = [];
  for (const role of roles) {
    const held = effectivePermissions(role.key, await storedKeys(role.id));
    result.push(roleSummary(role, counts.get(role.key) || 0, held.length));
  }
  return result;
}

async function findRole(schoolId, roleId, transaction) {
  const options = { where: { id: roleId, fkSchoolId: schoolId } };
  if (transaction) Object.assign(options, { transaction, lock: transaction.LOCK.UPDATE });
  const role = await Roles.findOne(options);
  if (!role) throw new ApiError(404, "Role not found");
  return role;
}

async function get(schoolId, roleId) {
  const role = await findRole(schoolId, roleId);
  const granted = new Set(effectivePermissions(role.key, await storedKeys(role.id)));
  const defaults = new Set(defaultPermissionsFor(role.key));
  const counts = await activeUserCounts(schoolId);
  return {
    ...roleSummary(role, counts.get(role.key) || 0, granted.size),
    permissions: PERMISSION_CATALOG.map((entry) => ({
      key: entry.key,
      granted: granted.has(entry.key),
      isDefault: defaults.has(entry.key),
      lockReason: lockReasonFor(role.key, entry.key),
    })),
  };
}

/** The keys to store for a request, refusing any locked key the role does not already hold. */
function desiredKeys(role, requested, current) {
  const desired = new Set(defaultPermissionsFor(role.key).filter((key) => ALWAYS_GRANTED.has(key)));
  for (const key of new Set(requested)) {
    const reason = lockReasonFor(role.key, key);
    if (reason === null) desired.add(key);
    else if (!current.has(key)) throw new ApiError(400, `"${key}" cannot be granted to ${role.label}: ${reason}`);
  }
  return desired;
}

async function applyPermissions(actor, roleId, { permissions, reason, version }, action) {
  const role = await sequelize.transaction(async (transaction) => {
    const locked = await findRole(actor.schoolId, roleId, transaction);
    if (locked.key === USER_ROLES.SUPER_ADMIN) {
      throw new ApiError(400, "The Super Admin always holds every permission.");
    }
    if (locked.version !== version) {
      throw new ApiError(409, "This role was changed by someone else. Reload it and try again.");
    }
    const current = new Set(effectivePermissions(locked.key, await storedKeys(locked.id, transaction)));
    const desired = desiredKeys(locked, permissions, current);
    const added = [...desired].filter((key) => !current.has(key)).sort();
    const removed = [...current].filter((key) => !desired.has(key)).sort();
    if (!added.length && !removed.length) throw new ApiError(400, "There are no permission changes to save.");

    await RolePermissions.destroy({ where: { fkRoleId: locked.id }, transaction });
    await permissionService.insertGrants(locked.id, [...desired], actor.id, transaction);
    await locked.update({ version: locked.version + 1 }, { transaction });
    await auditService.record(actor, `${action} for ${locked.label}`, {
      entityType: ROLE_ENTITY,
      entityId: locked.id,
      metadata: { roleKey: locked.key, roleLabel: locked.label, added, removed, reason },
    }, { transaction });
    return locked;
  });
  permissionService.invalidateSchool(actor.schoolId);
  return get(actor.schoolId, role.id);
}

function updatePermissions(actor, roleId, body) {
  return applyPermissions(actor, roleId, body, "updated permissions");
}

async function resetToDefault(actor, roleId, { reason, version }) {
  const role = await findRole(actor.schoolId, roleId);
  return applyPermissions(actor, roleId, { permissions: defaultPermissionsFor(role.key), reason, version }, "reset permissions");
}

async function listUsers(schoolId, roleId) {
  const role = await findRole(schoolId, roleId);
  const users = await Users.findAll({
    where: { fkSchoolId: schoolId, role: role.key },
    attributes: ["id", "firstName", "lastName", "email", "status", "role"],
    order: [["firstName", "ASC"], ["id", "ASC"]],
  });
  return users.map((user) => ({
    id: user.id,
    name: user.fullName,
    email: user.email,
    status: user.status,
    role: user.role,
    canChangeRole: STAFF_PORTAL_ROLES.includes(user.role),
  }));
}

/** Locks the school's active Super Admins and refuses to leave the school without one. */
async function assertAnotherSuperAdmin(schoolId, userId, transaction) {
  const others = await Users.findAll({
    where: { fkSchoolId: schoolId, role: USER_ROLES.SUPER_ADMIN, status: USER_STATUS.ACTIVE, id: { [Op.ne]: userId } },
    attributes: ["id"],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  if (!others.length) throw new ApiError(409, "Each school needs at least one active Super Admin.");
}

async function changeUserRole(actor, userId, { role: roleKey, reason }) {
  if (!STAFF_PORTAL_ROLES.includes(roleKey)) throw new ApiError(400, "Only staff portal roles can be assigned here.");
  if (userId === actor.id) throw new ApiError(400, "You cannot change your own role.");
  await sequelize.transaction(async (transaction) => {
    const user = await Users.findOne({
      where: { id: userId, fkSchoolId: actor.schoolId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!user) throw new ApiError(404, "User not found");
    if (!STAFF_PORTAL_ROLES.includes(user.role)) {
      throw new ApiError(400, "Teachers and parents keep their own portal; their role cannot be changed here.");
    }
    if (user.role === roleKey) throw new ApiError(400, "The user already has this role.");
    if (user.role === USER_ROLES.SUPER_ADMIN) await assertAnotherSuperAdmin(actor.schoolId, user.id, transaction);

    const from = user.role;
    await user.update({ role: roleKey }, { transaction });
    await auditService.record(actor, `changed role of ${user.email}`, {
      entityType: USER_ROLE_ENTITY,
      entityId: user.id,
      metadata: { userEmail: user.email, from, to: roleKey, fromLabel: ROLE_LABELS.get(from), toLabel: ROLE_LABELS.get(roleKey), reason },
    }, { transaction });
  });
  return { id: userId, role: roleKey };
}

module.exports = {
  catalog,
  list,
  get,
  updatePermissions,
  resetToDefault,
  listUsers,
  changeUserRole,
  ROLE_ENTITY,
  USER_ROLE_ENTITY,
};
