"use strict";

const bcrypt = require("bcryptjs");
const {
  Parents,
  Users,
  Students,
  StudentParents,
  sequelize,
} = require("../models");
const { USER_ROLES, USER_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");

async function list(schoolId) {
  return Parents.findAll({
    where: { fkSchoolId: schoolId },
    include: [
      { model: Users, as: "user", attributes: { exclude: ["password"] } },
      { model: Students, as: "students", through: { attributes: ["isPrimary"] } },
    ],
    order: [["id", "ASC"]],
  });
}

async function createWithUser(schoolId, payload) {
  const { firstName, lastName, email, phone, password, relation, gender } = payload;
  const existing = await Users.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, "Email already in use");

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password || "ChangeMe123!", salt);

  return sequelize.transaction(async (t) => {
    const user = await Users.create(
      {
        fkSchoolId: schoolId,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || null,
        password: hashed,
        role: USER_ROLES.PARENT,
        gender: gender || null,
        status: USER_STATUS.ACTIVE,
      },
      { transaction: t },
    );
    const parent = await Parents.create(
      {
        fkUserId: user.id,
        fkSchoolId: schoolId,
        relation: relation || "Guardian",
      },
      { transaction: t },
    );
    return Parents.findByPk(parent.id, {
      include: [{ model: Users, as: "user", attributes: { exclude: ["password"] } }],
      transaction: t,
    });
  });
}

async function linkStudent(parentId, schoolId, studentId, isPrimary = false) {
  const parent = await Parents.findOne({ where: { id: parentId, fkSchoolId: schoolId } });
  if (!parent) throw new ApiError(404, "Parent not found");
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: schoolId } });
  if (!student) throw new ApiError(404, "Student not found");

  const [link] = await StudentParents.findOrCreate({
    where: { fkParentId: parentId, fkStudentId: studentId },
    defaults: { isPrimary },
  });
  if (isPrimary) await link.update({ isPrimary: true });
  return link;
}

module.exports = { list, createWithUser, linkStudent };
