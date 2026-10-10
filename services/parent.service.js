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
  const existing = await Users.findOne({ where: { email: email.toLowerCase(), fkSchoolId: schoolId } });
  if (existing) throw new ApiError(409, "Email already in use");

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password || "ChangeMe123!", salt);

  const { parentRecord, user } = await sequelize.transaction(async (t) => {
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
        primaryContactNumber: phone || null,
        ...(relation === "Father" ? { fatherName: `${firstName} ${lastName}`.trim() } : {}),
        ...(relation === "Mother" ? { motherName: `${firstName} ${lastName}`.trim() } : {}),
      },
      { transaction: t },
    );
    const record = await Parents.findByPk(parent.id, {
      include: [{ model: Users, as: "user", attributes: { exclude: ["password"] } }],
      transaction: t,
    });
    return { parentRecord: record, user };
  });

  try {
    const authService = require("./auth.service");
    await authService.sendUserInvitation(user, USER_ROLES.PARENT);
  } catch (err) {
    console.error("Failed to send parent invitation email:", err.message);
  }

  return parentRecord;
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

/** The signed-in parent's linked children (§12). */
async function myChildren(user) {
  const parent = await Parents.findOne({
    where: { fkUserId: user.id, fkSchoolId: user.schoolId },
    include: [{ model: Students, as: "students", through: { attributes: ["isPrimary"] } }],
  });
  if (!parent) throw new ApiError(404, "Parent profile not found");
  return parent.students;
}

module.exports = { myChildren, list, createWithUser, linkStudent };
