"use strict";

const bcrypt = require("bcryptjs");
const { sequelize, Schools, Users, Teachers, AcademicSessions } = require("../../models");
const { USER_ROLES, USER_STATUS } = require("../../constants");
const { SYSTEM_ROLES } = require("../../constants/roles");
const permissionService = require("../../services/permission.service");
const feeTypePolicyService = require("../../services/fee_type_policy.service");
const concessionReasonService = require("../../services/concession_reason.service");

/**
 * Base data for a fresh database built from database/migrations-consolidated:
 * the permission catalog, one school with its system roles, fee-type policies and concession
 * reasons, and three staff logins for each staff role. Settings are not stored; the app falls back
 * to SETTING_DEFAULTS until someone saves them.
 *
 * Every value comes from the environment. Passwords are required, never logged, and hashed here:
 *   SEED_SUPER_ADMIN_PASSWORD, SEED_OPERATIONS_MANAGER_PASSWORD,
 *   SEED_ACCOUNTANT_PASSWORD, SEED_TEACHER_PASSWORD
 *   SEED_SCHOOL_NAME, SEED_SCHOOL_EMAIL, SEED_EMAIL_DOMAIN (required)
 *   SEED_SCHOOL_CODE, SEED_SCHOOL_PHONE, SEED_SCHOOL_ADDRESS, SEED_SCHOOL_WEBSITE (optional)
 *   SEED_SESSION_NAME, SEED_SESSION_START, SEED_SESSION_END (optional, all three or none)
 * Re-running is safe: an existing school with SEED_SCHOOL_EMAIL is left alone.
 */

const USERS_PER_ROLE = 3;
const MIN_PASSWORD_LENGTH = 8;
const HASH_ROUNDS = 10;

const STAFF_ROLES = [
  { role: USER_ROLES.SUPER_ADMIN, env: "SEED_SUPER_ADMIN_PASSWORD", slug: "admin" },
  { role: USER_ROLES.OPERATIONS_MANAGER, env: "SEED_OPERATIONS_MANAGER_PASSWORD", slug: "operations" },
  { role: USER_ROLES.ACCOUNTANT, env: "SEED_ACCOUNTANT_PASSWORD", slug: "accountant" },
  { role: USER_ROLES.TEACHER, env: "SEED_TEACHER_PASSWORD", slug: "teacher" },
];

const ROLE_LABELS = new Map(SYSTEM_ROLES.map((entry) => [entry.key, entry.label]));

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Seeder needs ${name} in the environment.`);
  return value;
}

function optional(name) {
  const value = process.env[name];
  if (!value) return null;
  return value;
}

function password(name) {
  const value = required(name);
  if (value.length < MIN_PASSWORD_LENGTH) throw new Error(`${name} must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  return value;
}

function sessionFromEnv() {
  const values = ["SEED_SESSION_NAME", "SEED_SESSION_START", "SEED_SESSION_END"].map(optional);
  const given = values.filter(Boolean).length;
  if (given === 0) return null;
  if (given !== values.length) throw new Error("Set all of SEED_SESSION_NAME, SEED_SESSION_START and SEED_SESSION_END, or none.");
  const [name, startDate, endDate] = values;
  return { name, startDate, endDate };
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
    const schoolEmail = required("SEED_SCHOOL_EMAIL");
    const schoolName = required("SEED_SCHOOL_NAME");
    const domain = required("SEED_EMAIL_DOMAIN");
    const session = sessionFromEnv();
    const hashes = new Map();
    for (const entry of STAFF_ROLES) hashes.set(entry.role, await bcrypt.hash(password(entry.env), HASH_ROUNDS));

    await permissionService.syncCatalog();
    const found = await Schools.findOne({ where: { email: schoolEmail }, paranoid: false });
    if (found) return;

    await sequelize.transaction(async (transaction) => {
      const school = await Schools.create(
        {
          name: schoolName,
          email: schoolEmail,
          code: optional("SEED_SCHOOL_CODE"),
          phone: optional("SEED_SCHOOL_PHONE"),
          address: optional("SEED_SCHOOL_ADDRESS"),
          website: optional("SEED_SCHOOL_WEBSITE"),
          status: "active",
        },
        { transaction },
      );
      await permissionService.ensureSystemRoles(school.id, transaction);
      await feeTypePolicyService.ensureDefaults(school.id, transaction);
      await concessionReasonService.ensureSeeded(school.id, transaction);
      if (session) await AcademicSessions.create({ fkSchoolId: school.id, ...session, isCurrent: true }, { transaction });

      const users = await Users.bulkCreate(staffUsers(school.id, domain, hashes), { transaction });
      const teachers = users.filter((user) => user.role === USER_ROLES.TEACHER);
      await Teachers.bulkCreate(teachers.map((user) => ({ fkSchoolId: school.id, fkUserId: user.id })), { transaction });
    });
  },

  async down() {
    const school = await Schools.findOne({ where: { email: required("SEED_SCHOOL_EMAIL") }, paranoid: false });
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
