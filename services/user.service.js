"use strict";

const bcrypt = require("bcryptjs");
const { Users, Teachers, Subjects, TeacherSubjectAssignments, sequelize } = require("../models");
const { today } = require("../utils/dates");
const { USER_ROLES, USER_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");

const defaultExcludePassword = { attributes: { exclude: ["password"] } };

async function create(userData, options = {}) {
  return Users.create(userData, options);
}

async function findById(id, options = {}) {
  return Users.findOne({ ...defaultExcludePassword, ...options, where: { id } });
}

async function findByEmail(email, options = {}) {
  return Users.findOne({
    ...defaultExcludePassword,
    ...options,
    where: { email },
  });
}

async function getByEmailWithPassword(email) {
  return Users.findOne({ where: { email } });
}

async function getByIdWithPassword(id) {
  return Users.findByPk(id);
}

async function update(userId, userData, options = {}) {
  const [updated] = await Users.update(userData, {
    where: { id: userId },
    ...options,
  });
  return updated;
}

async function listBySchool(schoolId, { role, page = 1, pageSize = 20 } = {}) {
  const where = { fkSchoolId: schoolId };
  if (role) where.role = role;
  const limit = Math.min(Number(pageSize) || 20, 1000);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const { rows, count } = await Users.findAndCountAll({
    where,
    ...defaultExcludePassword,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });
  return { rows, count, page: Number(page) || 1, pageSize: limit };
}

const STAFF_ROLES = [USER_ROLES.SUPER_ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.ACCOUNTANT, USER_ROLES.TEACHER];

/**
 * Creates a staff login. Teachers must be created with exactly one subject
 * (UR-02 / BR-01); operations managers may only create teachers, all other
 * staff roles are created by the super admin.
 */
async function createStaffUser(actor, payload) {
  const { firstName, lastName, email, phone, password, role, gender, employeeCode, subjectId } = payload;
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, "Only staff users can be created here");
  if (actor.role !== USER_ROLES.SUPER_ADMIN && role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, "Only the super admin can create non-teaching staff.");
  }
  const schoolId = actor.schoolId;
  if (role === USER_ROLES.TEACHER) {
    const subject = subjectId && (await Subjects.findOne({ where: { id: subjectId, fkSchoolId: schoolId } }));
    if (!subject) throw new ApiError(400, "A teacher must be created with one subject.");
  }
  const existing = await findByEmail(email.toLowerCase());
  if (existing) throw new ApiError(409, "Email already in use");

  const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));

  const { json, user } = await sequelize.transaction(async (t) => {
    const user = await Users.create(
      {
        fkSchoolId: schoolId,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || null,
        password: hashed,
        role,
        gender: gender || null,
        status: USER_STATUS.ACTIVE,
      },
      { transaction: t },
    );

    if (role === USER_ROLES.TEACHER) {
      const teacher = await Teachers.create(
        { fkUserId: user.id, fkSchoolId: schoolId, employeeCode: employeeCode || null, fkSubjectId: subjectId },
        { transaction: t },
      );
      await TeacherSubjectAssignments.create(
        {
          fkSchoolId: schoolId,
          fkTeacherId: teacher.id,
          fkSubjectId: subjectId,
          effectiveFrom: today(),
          fkAssignedByUserId: actor.id,
          reason: "Initial subject",
        },
        { transaction: t },
      );
    }

    const json = user.toJSON();
    delete json.password;
    return { json, user };
  });

  try {
    const authService = require("./auth.service");
    await authService.sendUserInvitation(user, role);
  } catch (err) {
    console.error("Failed to send staff invitation email:", err.message);
  }

  return json;
}

module.exports = {
  create,
  findById,
  findByEmail,
  getByEmailWithPassword,
  getByIdWithPassword,
  update,
  listBySchool,
  createStaffUser,
};
