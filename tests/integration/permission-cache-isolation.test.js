"use strict";

/**
 * Permission caches across schools and API processes. A second copy of the app (its own module
 * registry, Sequelize pool and permission cache) stands in for another pm2 instance sharing the DB.
 */
const { QueryTypes } = require("sequelize");
const app = require("../../app");
const { sequelize, Roles, AuditLogs } = require("../../models");
const {
  defaultPermissionsFor,
  PERMISSION_CATALOG,
} = require("../../constants/permissions");
const permissionService = require("../../services/permission.service");
const { makeSchool, makeUser, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");

const REASON = "Access review";
const REVOKED = "audit.read";
const NEW_KEY = "updates.write";

let otherInstance;
jest.isolateModules(() => {
  otherInstance = {
    app: require("../../app"),
    models: require("../../models"),
    permissionService: require("../../services/permission.service"),
  };
});

const call = (target, token, method, path, body) =>
  request(target, { method, path: `/api${path}`, token, body });

async function schoolWithStaff() {
  const { school } = await makeSchool();
  await permissionService.permissionsFor(school.id, "teacher");
  return {
    school,
    admin: await makeUser(school.id, "super_admin"),
    ops: await makeUser(school.id, "operations_manager"),
  };
}

async function grantsOf(schoolId, roleKey) {
  const rows = await sequelize.query(
    `SELECT rp.permission_key FROM role_permissions rp JOIN roles r ON r.id = rp.fk_role_id
      WHERE r.fk_school_id = :schoolId AND r.key = :roleKey ORDER BY 1`,
    { replacements: { schoolId, roleKey }, type: QueryTypes.SELECT },
  );
  return rows.map((row) => row.permission_key);
}

async function revokeFromOps(target, staff) {
  const role = await Roles.findOne({
    where: { fkSchoolId: staff.school.id, key: "operations_manager" },
  });
  const permissions = defaultPermissionsFor("operations_manager").filter(
    (key) => key !== REVOKED,
  );
  const res = await call(
    target,
    tokenFor(staff.admin),
    "PUT",
    `/roles/${role.id}/permissions`,
    { permissions, reason: REASON, version: role.version },
  );
  expect(res.status).toBe(200);
}

describe("permission caches", () => {
  let a;
  let b;

  beforeAll(async () => {
    await sequelize.authenticate();
    a = await schoolWithStaff();
    b = await schoolWithStaff();
  });

  afterAll(async () => {
    await otherInstance.models.sequelize.close();
  });

  test("a change in School A leaves School B's grants and cached permissions unchanged", async () => {
    const grantsBefore = await grantsOf(b.school.id, "operations_manager");
    const cachedBefore = [
      ...(await permissionService.permissionsFor(
        b.school.id,
        "operations_manager",
      )),
    ].sort();
    const otherBefore = [
      ...(await otherInstance.permissionService.permissionsFor(
        b.school.id,
        "operations_manager",
      )),
    ].sort();

    await revokeFromOps(app, a);

    expect(await grantsOf(a.school.id, "operations_manager")).not.toContain(
      REVOKED,
    );
    expect(await grantsOf(b.school.id, "operations_manager")).toEqual(
      grantsBefore,
    );
    expect(
      [
        ...(await permissionService.permissionsFor(
          b.school.id,
          "operations_manager",
        )),
      ].sort(),
    ).toEqual(cachedBefore);
    expect(
      [
        ...(await otherInstance.permissionService.permissionsFor(
          b.school.id,
          "operations_manager",
        )),
      ].sort(),
    ).toEqual(otherBefore);
    expect(cachedBefore).toContain(REVOKED);
    expect(
      (await call(otherInstance.app, tokenFor(b.ops), "GET", "/audit-logs"))
        .status,
    ).toBe(200);
  });

  test("a revoke made through one instance is denied on the next request to another", async () => {
    const staff = await schoolWithStaff();
    // Both instances have the grant cached.
    expect(
      (await call(app, tokenFor(staff.ops), "GET", "/audit-logs")).status,
    ).toBe(200);
    expect(
      (await call(otherInstance.app, tokenFor(staff.ops), "GET", "/audit-logs"))
        .status,
    ).toBe(200);

    await revokeFromOps(app, staff);

    expect(
      (await call(otherInstance.app, tokenFor(staff.ops), "GET", "/audit-logs"))
        .status,
    ).toBe(403);
    expect(
      (await call(app, tokenFor(staff.ops), "GET", "/audit-logs")).status,
    ).toBe(403);
  });

  test("a revoke made through the other instance applies here too", async () => {
    const staff = await schoolWithStaff();
    expect(
      (await call(app, tokenFor(staff.ops), "GET", "/audit-logs")).status,
    ).toBe(200);

    await revokeFromOps(otherInstance.app, staff);

    expect(
      (await call(app, tokenFor(staff.ops), "GET", "/audit-logs")).status,
    ).toBe(403);
  });
});

describe("new catalog keys", () => {
  const entry = PERMISSION_CATALOG.find((item) => item.key === NEW_KEY);

  test("are granted only to uncustomised roles, and every outcome is audited per school", async () => {
    const plain = await schoolWithStaff();
    const customised = await schoolWithStaff();
    const transaction = await sequelize.transaction();
    try {
      const teacherOf = (staff) =>
        Roles.findOne({
          where: { fkSchoolId: staff.school.id, key: "teacher" },
          transaction,
        });
      const plainTeacher = await teacherOf(plain);
      const customTeacher = await teacherOf(customised);
      // As if NEW_KEY had just been added to the catalog, and one school had since edited its Teacher role.
      await sequelize.query(
        "DELETE FROM role_permissions WHERE permission_key = :key AND fk_role_id IN (:ids)",
        {
          replacements: {
            key: NEW_KEY,
            ids: [plainTeacher.id, customTeacher.id],
          },
          transaction,
        },
      );
      await customTeacher.update(
        { version: customTeacher.version + 1 },
        { transaction },
      );
      const versionOf = async (schoolId) => {
        const rows = await sequelize.query(
          "SELECT version FROM school_permission_versions WHERE fk_school_id = :schoolId",
          {
            replacements: { schoolId },
            type: QueryTypes.SELECT,
            transaction,
          },
        );
        return rows.map((row) => Number(row.version));
      };
      const plainVersion = await versionOf(plain.school.id);
      const customVersion = await versionOf(customised.school.id);

      await permissionService.grantNewKeyToDefaults(entry, transaction);

      const granted = async (roleId) =>
        sequelize.query(
          "SELECT 1 FROM role_permissions WHERE fk_role_id = :roleId AND permission_key = :key",
          {
            replacements: { roleId, key: NEW_KEY },
            type: QueryTypes.SELECT,
            transaction,
          },
        );
      expect(await granted(plainTeacher.id)).toHaveLength(1);
      expect(await granted(customTeacher.id)).toHaveLength(0);

      const auditFor = (role) =>
        AuditLogs.findOne({
          where: { entityType: "role", entityId: role.id },
          order: [["id", "DESC"]],
          transaction,
        });
      const plainAudit = await auditFor(plainTeacher);
      const customAudit = await auditFor(customTeacher);
      expect(plainAudit.fkSchoolId).toBe(plain.school.id);
      expect(plainAudit.actorLabel).toBe("system");
      expect(plainAudit.metadata).toEqual(
        expect.objectContaining({ permissionKey: NEW_KEY, added: [NEW_KEY] }),
      );
      expect(customAudit.fkSchoolId).toBe(customised.school.id);
      expect(customAudit.action).toMatch(/not granted to customised/);
      expect(customAudit.metadata).toEqual(
        expect.objectContaining({ permissionKey: NEW_KEY, added: [] }),
      );

      expect((await versionOf(plain.school.id)).map(Number)).not.toEqual(
        plainVersion,
      );
      expect(await versionOf(customised.school.id)).toEqual(customVersion);
    } finally {
      await transaction.rollback();
    }
  });
});
