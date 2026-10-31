"use strict";

/**
 * Seeds the permission catalog and, for every school, the five system roles with exactly
 * the permissions the static matrix granted before this migration (plus roles.manage for the
 * Super Admin). Nothing changes on day one; tests/integration/roles-migration-snapshot proves it.
 */
const { PERMISSION_CATALOG, defaultPermissionsFor } = require("../../constants/permissions");
const { SYSTEM_ROLES } = require("../../constants/roles");

function catalogRows(now) {
  return PERMISSION_CATALOG.map((entry) => ({
    key: entry.key,
    module: entry.module,
    action: entry.action,
    label: entry.label,
    description: entry.description,
    risk: entry.risk,
    assignable_roles: [...new Set([...entry.roles, ...entry.grantableTo])],
    created_at: now,
    updated_at: now,
  }));
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      await queryInterface.bulkInsert("permissions", catalogRows(now), { transaction });

      for (const role of SYSTEM_ROLES) {
        await queryInterface.sequelize.query(
          `INSERT INTO roles (fk_school_id, key, label, description, portal, is_system, version, created_at, updated_at)
           SELECT s.id, :key, :label, :description, :portal, true, 1, :now, :now FROM schools s`,
          { replacements: { ...role, now }, transaction },
        );
        await queryInterface.sequelize.query(
          `INSERT INTO role_permissions (fk_role_id, permission_key, created_at, updated_at)
           SELECT r.id, grant_key, :now, :now
             FROM roles r CROSS JOIN unnest(ARRAY[:keys]::varchar[]) AS grant_key
            WHERE r.key = :key`,
          { replacements: { key: role.key, keys: defaultPermissionsFor(role.key), now }, transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("role_permissions", null, { transaction });
      await queryInterface.bulkDelete("roles", null, { transaction });
      await queryInterface.bulkDelete("permissions", null, { transaction });
    });
  },
};
