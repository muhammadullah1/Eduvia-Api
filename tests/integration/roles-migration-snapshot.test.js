"use strict";

/**
 * Day-one guarantee of the dynamic roles migration: every system role holds exactly what the
 * static matrix granted before (frozen in fixtures), plus `roles.manage` for the Super Admin.
 */
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models");
const { defaultPermissionsFor } = require("../../constants/permissions");
const { SYSTEM_ROLES } = require("../../constants/roles");
const permissionService = require("../../services/permission.service");
const { makeSchool } = require("../helpers/school");
const before = require("../fixtures/permission-matrix-before-roles.json");

const ADDED_BY_ROLES_MIGRATION = { super_admin: ["roles.manage"] };

function expectedFor(roleKey) {
  return [...before[roleKey], ...(ADDED_BY_ROLES_MIGRATION[roleKey] || [])].sort();
}

describe("roles migration snapshot", () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await permissionService.ready();
  });

  test.each(SYSTEM_ROLES.map((role) => role.key))("%s defaults equal the pre-migration matrix", (roleKey) => {
    expect([...defaultPermissionsFor(roleKey)].sort()).toEqual(expectedFor(roleKey));
  });

  test("every unedited seeded role in every school stores exactly its defaults", async () => {
    for (const role of SYSTEM_ROLES) {
      const [row] = await sequelize.query(
        `SELECT COUNT(*)::int AS mismatched FROM roles r
          WHERE r.key = :key AND r.version = 1 AND ARRAY(
            SELECT rp.permission_key::text FROM role_permissions rp WHERE rp.fk_role_id = r.id ORDER BY 1
          ) <> ARRAY[:expected]::text[]`,
        { replacements: { key: role.key, expected: expectedFor(role.key) }, type: QueryTypes.SELECT },
      );
      expect(row.mismatched).toBe(0);
    }
  });

  test("a school without roles gets them, with the same effective permissions", async () => {
    const { school } = await makeSchool();
    for (const role of SYSTEM_ROLES) {
      const held = await permissionService.permissionsFor(school.id, role.key);
      expect([...held].sort()).toEqual(expectedFor(role.key));
    }
    const [row] = await sequelize.query("SELECT COUNT(*)::int AS total FROM roles WHERE fk_school_id = :id", {
      replacements: { id: school.id },
      type: QueryTypes.SELECT,
    });
    expect(row.total).toBe(SYSTEM_ROLES.length);
  });
});
