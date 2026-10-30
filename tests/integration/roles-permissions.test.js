"use strict";

/**
 * Dynamic roles: effective permissions per school, live grant/revoke, locked invariants,
 * optimistic versioning, the last-Super-Admin guard, audit entries and tenant isolation.
 */
const app = require("../../app");
const { sequelize, Roles, AuditLogs, Users } = require("../../models");
const { authorize } = require("../../middlewares/authorize");
const { defaultPermissionsFor } = require("../../constants/permissions");
const roleService = require("../../services/role.service");
const permissionService = require("../../services/permission.service");
const { actorFor, makeSchool, makeUser, tokenFor } = require("../helpers/school");
const { request } = require("../helpers/http");

const call = (token, method, path, body) => request(app, { method, path: `/api${path}`, token, body });
const REASON = "Quarterly access review";
const TOTAL_KEYS = /"(todayCollection|totalCollected|collectedThisMonth|totalDue|netIncome)"/;

async function schoolWithStaff() {
  const { school } = await makeSchool();
  await permissionService.permissionsFor(school.id, "teacher");
  return {
    school,
    admin: await makeUser(school.id, "super_admin"),
    ops: await makeUser(school.id, "operations_manager"),
    acc: await makeUser(school.id, "accountant"),
    teacher: await makeUser(school.id, "teacher"),
  };
}

async function roleOf(schoolId, key) {
  return Roles.findOne({ where: { fkSchoolId: schoolId, key } });
}

describe("dynamic roles and permissions", () => {
  let a;
  let b;

  beforeAll(async () => {
    await sequelize.authenticate();
    a = await schoolWithStaff();
    b = await schoolWithStaff();
  });

  test("an unknown permission key fails when the route is declared", () => {
    expect(() => authorize("fees.everything")).toThrow('Unknown permission "fees.everything"');
  });

  test("GET /auth/me returns the effective permissions", async () => {
    const res = await call(tokenFor(a.ops), "GET", "/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.portal.slug).toBe("admin");
    expect([...res.body.data.permissions].sort()).toEqual([...defaultPermissionsFor("operations_manager")].sort());
    expect(res.body.data.user.password).toBeUndefined();
  });

  test("only the Super Admin manages roles", async () => {
    expect((await call(tokenFor(a.admin), "GET", "/roles")).status).toBe(200);
    for (const user of [a.ops, a.acc, a.teacher]) {
      expect((await call(tokenFor(user), "GET", "/roles")).status).toBe(403);
    }
  });

  test("lists the five system roles with user counts, scoped to the school", async () => {
    const res = await call(tokenFor(a.admin), "GET", "/roles");
    expect(res.body.data.map((role) => role.key)).toEqual(["super_admin", "operations_manager", "accountant", "teacher", "parent"]);
    const ops = res.body.data.find((role) => role.key === "operations_manager");
    expect(ops.userCount).toBe(1);
    const other = await roleOf(b.school.id, "operations_manager");
    expect((await call(tokenFor(a.admin), "GET", `/roles/${other.id}`)).status).toBe(404);
    expect((await call(tokenFor(a.admin), "GET", `/roles/${other.id}/users`)).status).toBe(404);
  });

  test("a revoke applies at once, in that school only, and is audited", async () => {
    const role = await roleOf(a.school.id, "operations_manager");
    const kept = defaultPermissionsFor("operations_manager").filter((key) => key !== "audit.read");
    expect((await call(tokenFor(a.ops), "GET", "/audit-logs")).status).toBe(200);

    const res = await call(tokenFor(a.admin), "PUT", `/roles/${role.id}/permissions`, { permissions: kept, reason: REASON, version: role.version });
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(role.version + 1);
    expect((await call(tokenFor(a.ops), "GET", "/audit-logs")).status).toBe(403);
    expect((await call(tokenFor(b.ops), "GET", "/audit-logs")).status).toBe(200);

    const entry = await AuditLogs.findOne({ where: { fkSchoolId: a.school.id, entityType: "role", entityId: role.id }, order: [["id", "DESC"]] });
    expect(entry.metadata).toEqual(expect.objectContaining({ roleKey: "operations_manager", added: [], removed: ["audit.read"], reason: REASON }));
    expect(entry.actorUserId).toBe(a.admin.id);
  });

  test("a stale version is refused with 409", async () => {
    const role = await roleOf(a.school.id, "operations_manager");
    const res = await call(tokenFor(a.admin), "PUT", `/roles/${role.id}/permissions`, {
      permissions: defaultPermissionsFor("operations_manager"),
      reason: REASON,
      version: role.version - 1,
    });
    expect(res.status).toBe(409);
  });

  test("reset to default restores today's matrix", async () => {
    const role = await roleOf(a.school.id, "operations_manager");
    const res = await call(tokenFor(a.admin), "POST", `/roles/${role.id}/reset`, { reason: REASON, version: role.version });
    expect(res.status).toBe(200);
    expect((await call(tokenFor(a.ops), "GET", "/audit-logs")).status).toBe(200);
  });

  test("locked financial controls cannot be granted, nor can the Super Admin role be edited", async () => {
    const acc = await roleOf(a.school.id, "accountant");
    for (const key of ["fees.totals", "income.read", "finance.reports", "roles.manage", "settings.fees.update"]) {
      const res = await call(tokenFor(a.admin), "PUT", `/roles/${acc.id}/permissions`, {
        permissions: [...defaultPermissionsFor("accountant"), key],
        reason: REASON,
        version: acc.version,
      });
      expect(res.status).toBe(400);
    }
    const ops = await roleOf(a.school.id, "operations_manager");
    const amounts = await call(tokenFor(a.admin), "PUT", `/roles/${ops.id}/permissions`, {
      permissions: [...defaultPermissionsFor("operations_manager"), "fees.amounts.read"],
      reason: REASON,
      version: ops.version,
    });
    expect(amounts.status).toBe(400);
    const sa = await roleOf(a.school.id, "super_admin");
    const res = await call(tokenFor(a.admin), "PUT", `/roles/${sa.id}/permissions`, { permissions: [], reason: REASON, version: sa.version });
    expect(res.status).toBe(400);
  });

  test("a stored grant outside the grantable set is never honoured", async () => {
    const acc = await roleOf(b.school.id, "accountant");
    await sequelize.query(
      "INSERT INTO role_permissions (fk_role_id, permission_key, created_at, updated_at) VALUES (:id, 'fees.totals', NOW(), NOW())",
      { replacements: { id: acc.id } },
    );
    await acc.update({ version: acc.version + 1 });
    permissionService.invalidateSchool(b.school.id);
    expect((await call(tokenFor(b.acc), "GET", "/fees/summary")).status).toBe(403);
    const overview = await call(tokenFor(b.acc), "GET", "/fees/collect/overview");
    expect(overview.status).toBe(200);
    expect(JSON.stringify(overview.body)).not.toMatch(TOTAL_KEYS);
  });

  test("the accountant never receives fee totals", async () => {
    const overview = await call(tokenFor(a.acc), "GET", "/fees/collect/overview");
    expect(overview.status).toBe(200);
    expect(JSON.stringify(overview.body)).not.toMatch(TOTAL_KEYS);
    expect((await call(tokenFor(a.acc), "GET", "/fees/summary")).status).toBe(403);
    expect((await call(tokenFor(a.acc), "GET", "/reports/dashboard")).status).toBe(403);
  });

  test("role changes move staff between staff roles and keep an active Super Admin", async () => {
    const extra = await makeUser(a.school.id, "operations_manager");
    const promote = await call(tokenFor(a.admin), "PATCH", `/roles/users/${extra.id}`, { role: "accountant", reason: REASON });
    expect(promote.status).toBe(200);
    expect((await Users.findByPk(extra.id)).role).toBe("accountant");
    const entry = await AuditLogs.findOne({ where: { fkSchoolId: a.school.id, entityType: "user_role", entityId: extra.id } });
    expect(entry.metadata).toEqual(expect.objectContaining({ from: "operations_manager", to: "accountant", reason: REASON }));

    expect((await call(tokenFor(a.admin), "PATCH", `/roles/users/${a.admin.id}`, { role: "accountant", reason: REASON })).status).toBe(400);
    expect((await call(tokenFor(a.admin), "PATCH", `/roles/users/${a.teacher.id}`, { role: "accountant", reason: REASON })).status).toBe(400);
    expect((await call(tokenFor(a.admin), "PATCH", `/roles/users/${b.ops.id}`, { role: "accountant", reason: REASON })).status).toBe(404);
  });

  test("the last active Super Admin cannot be demoted", async () => {
    const { school } = await makeSchool();
    const first = await makeUser(school.id, "super_admin");
    const second = await makeUser(school.id, "super_admin");
    const ops = await makeUser(school.id, "operations_manager");
    expect((await call(tokenFor(first), "PATCH", `/roles/users/${second.id}`, { role: "operations_manager", reason: REASON })).status).toBe(200);
    expect((await call(tokenFor(first), "PATCH", `/roles/users/${first.id}`, { role: "accountant", reason: REASON })).status).toBe(400);
    await expect(
      roleService.changeUserRole(await actorFor(ops), first.id, { role: "accountant", reason: REASON }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await Users.findByPk(first.id)).role).toBe("super_admin");
  });

  test("a reason is required for every change", async () => {
    const role = await roleOf(a.school.id, "teacher");
    const res = await call(tokenFor(a.admin), "PUT", `/roles/${role.id}/permissions`, { permissions: [], version: role.version });
    expect(res.status).toBe(400);
  });
});
