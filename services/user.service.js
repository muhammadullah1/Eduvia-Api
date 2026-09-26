"use strict";

const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { Users, Teachers, Parents, sequelize } = require("../models");
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
  const limit = Math.min(Number(pageSize) || 20, 100);
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

async function createStaffUser(schoolId, payload) {
  const { firstName, lastName, email, phone, password, role, gender, employeeCode } = payload;
  if (![USER_ROLES.MANAGEMENT, USER_ROLES.TEACHER].includes(role)) {
    throw new ApiError(400, "Only management or teacher users can be created here");
  }
  const existing = await findByEmail(email.toLowerCase());
  if (existing) throw new ApiError(409, "Email already in use");

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  return sequelize.transaction(async (t) => {
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
      await Teachers.create(
        {
          fkUserId: user.id,
          fkSchoolId: schoolId,
          employeeCode: employeeCode || null,
        },
        { transaction: t },
      );
    }

    const json = user.toJSON();
    delete json.password;
    return json;
  });
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
