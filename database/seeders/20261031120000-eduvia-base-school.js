"use strict";

const bcrypt = require("bcryptjs");
const { USER_ROLES, USER_STATUS } = require("../../constants");
const { SYSTEM_ROLES } = require("../../constants/roles");

/**
 * DEVELOPMENT/STAGING ONLY. Base data for a fresh dev database built from database/migrations:
 * the permission catalog, one school with its system roles, fee-type policies and concession
 * reasons, and three staff logins for each staff role. Settings are not stored; the app falls back
 * to SETTING_DEFAULTS until someone saves them.
 *
 * All values below are hardcoded dev credentials; no environment variables are read. The deploy
 * workflow runs this on staging deploys only. It refuses to run when the app environment
 * (NODE_ENV, the same variable config/index.js reads as `env`) is production, so these logins can
 * never be created there.
 *
 * Idempotent: when a school with DEV_SCHOOL.email already exists (even soft-deleted) nothing is
 * created or changed.
 */

const PRODUCTION_ENV = "production";
const USERS_PER_ROLE = 3;
const HASH_ROUNDS = 10;

const DEV_SCHOOL = {
  name: "Eduvia Dev School",
  email: "office@dev.geteduvia.site",
  code: "EDUVIA-DEV",
};
const DEV_EMAIL_DOMAIN = "dev.geteduvia.site";

// Dev-only initial passwords. Change them after first login on any shared server.
const DEV_PASSWORDS = {
  [USER_ROLES.SUPER_ADMIN]: "DevOnly-SuperAdmin#Edv26",
  [USER_ROLES.OPERATIONS_MANAGER]: "DevOnly-OpsManager#Edv26",
  [USER_ROLES.ACCOUNTANT]: "DevOnly-Accountant#Edv26",
  [USER_ROLES.TEACHER]: "DevOnly-Teacher#Edv26",
};

const STAFF_ROLES = [
  { role: USER_ROLES.SUPER_ADMIN, slug: "admin" },
  { role: USER_ROLES.OPERATIONS_MANAGER, slug: "operations" },
  { role: USER_ROLES.ACCOUNTANT, slug: "accountant" },
  { role: USER_ROLES.TEACHER, slug: "teacher" },
];

const ROLE_LABELS = new Map(SYSTEM_ROLES.map((entry) => [entry.key, entry.label]));

function refuseProduction() {
  if (process.env.NODE_ENV === PRODUCTION_ENV) {
    throw new Error("Base-school seeder holds development-only credentials and refuses to run in production.");
  }
}

function staffUsers(schoolId, domain, hashes) {
  return STAFF_ROLES.flatMap((entry) =>
    Array.from({ length: USERS_PER_ROLE }, (unused, index) => ({
      fkSchoolId: schoolId,
      firstName: ROLE_LABELS.get(entry.role),
      lastName: String(index + 1),
      email: `${entry.slug}${index + 1}@${domain}`,
      password: hashes.get(entry.role),
      role: entry.role,
      status: USER_STATUS.ACTIVE,
    })),
  );
}

module.exports = {
  async up() {
    refuseProduction();
    // Loaded after the guard so a production run stops before touching the database.
    const { sequelize, Schools, Users, Teachers } = require("../../models");
    const permissionService = require("../../services/permission.service");
    const feeTypePolicyService = require("../../services/fee_type_policy.service");
    const concessionReasonService = require("../../services/concession_reason.service");

    const found = await Schools.findOne({ where: { email: DEV_SCHOOL.email }, paranoid: false });
    if (found) {
      console.log(`Base-school seeder: school ${found.id} already exists for ${DEV_SCHOOL.email}, nothing to do.`);
      return;
    }

    const hashes = new Map();
    for (const entry of STAFF_ROLES) hashes.set(entry.role, await bcrypt.hash(DEV_PASSWORDS[entry.role], HASH_ROUNDS));

    await permissionService.syncCatalog();
    await sequelize.transaction(async (transaction) => {
      const school = await Schools.create({ ...DEV_SCHOOL, status: "active" }, { transaction });
      await permissionService.ensureSystemRoles(school.id, transaction);
      await feeTypePolicyService.ensureDefaults(school.id, transaction);
      await concessionReasonService.ensureSeeded(school.id, transaction);

      const users = await Users.bulkCreate(staffUsers(school.id, DEV_EMAIL_DOMAIN, hashes), { transaction });
      const teachers = users.filter((user) => user.role === USER_ROLES.TEACHER);
      await Teachers.bulkCreate(teachers.map((user) => ({ fkSchoolId: school.id, fkUserId: user.id })), { transaction });
    });
  },

  async down() {
    refuseProduction();
    const { sequelize, Schools } = require("../../models");
    const school = await Schools.findOne({ where: { email: DEV_SCHOOL.email }, paranoid: false });
    if (!school) return;
    const replacements = { id: school.id };
    await sequelize.transaction(async (transaction) => {
      const run = (sql) => sequelize.query(sql, { replacements, transaction });
      await run(`DELETE FROM teachers WHERE fk_school_id = :id`);
      await run(`DELETE FROM users WHERE fk_school_id = :id`);
      await run(`DELETE FROM academic_sessions WHERE fk_school_id = :id`);
      await run(`DELETE FROM school_concession_reasons WHERE fk_school_id = :id`);
      await run(`DELETE FROM fee_type_policies WHERE fk_school_id = :id`);
      await run(`DELETE FROM role_permissions WHERE fk_role_id IN (SELECT id FROM roles WHERE fk_school_id = :id)`);
      await run(`DELETE FROM roles WHERE fk_school_id = :id`);
      await run(`DELETE FROM schools WHERE id = :id`);
    });
  },
};
