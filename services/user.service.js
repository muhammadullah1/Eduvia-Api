"use strict";

const bcrypt = require("bcryptjs");
const {
  Users,
  Teachers,
  Subjects,
  TeacherSubjectAssignments,
  TeacherClasses,
  TimetableSlots,
  sequelize,
} = require("../models");
const { isValidPhonePk, normalizePhonePk } = require("../utils/pakistan");
const authService = require("./auth.service");
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
  const { schoolId, ...findOptions } = options;
  const where = { email };
  if (schoolId) where.fkSchoolId = schoolId;
  return Users.findOne({
    ...defaultExcludePassword,
    ...findOptions,
    where,
  });
}

async function getByEmailWithPassword(email) {
  const rows = await Users.findAll({ where: { email } });
  if (rows.length > 1) {
    throw new ApiError(409, "This email is registered at more than one school");
  }
  return rows[0] || null;
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
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    role,
    gender,
    employeeCode,
    subjectId,
    photo,
  } = payload;
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, "Only staff users can be created here");
  if (actor.role !== USER_ROLES.SUPER_ADMIN && role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, "Only the super admin can create non-teaching staff.");
  }
  const schoolId = actor.schoolId;
  if (role === USER_ROLES.TEACHER) {
    const subject = subjectId && (await Subjects.findOne({ where: { id: subjectId, fkSchoolId: schoolId } }));
    if (!subject) throw new ApiError(400, "A teacher must be created with one subject.");
  }
  const existing = await findByEmail(email.toLowerCase(), { schoolId });
  if (existing) throw new ApiError(409, "Email already in use");
  if (phone) {
    const phoneTrimmed = String(phone).trim();
    if (!isValidPhonePk(phoneTrimmed)) {
      throw new ApiError(400, "Enter a valid Pakistani mobile number.");
    }
  }

  const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));

  const { json, user } = await sequelize.transaction(async (t) => {
    const user = await Users.create(
      {
        fkSchoolId: schoolId,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone ? normalizePhonePk(phone) : null,
        password: hashed,
        role,
        gender: gender || null,
        status: USER_STATUS.ACTIVE,
        photo: photo ? String(photo).trim() : null,
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
    await authService.sendUserInvitation(user, role);
  } catch (err) {
    console.error("Failed to send staff invitation email:", err.message);
  }

  return json;
}

async function updateStaffUser(actor, userId, payload) {
  const user = await Users.findOne({
    where: { id: userId, fkSchoolId: actor.schoolId },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (!STAFF_ROLES.includes(user.role)) {
    throw new ApiError(400, "Only staff accounts can be updated here.");
  }
  if (actor.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, "Only the super admin can edit non-teaching staff.");
  }
  const updates = {};
  if (payload.firstName !== undefined) updates.firstName = payload.firstName;
  if (payload.lastName !== undefined) updates.lastName = payload.lastName;
  if (payload.phone !== undefined) {
    const phone = payload.phone ? String(payload.phone).trim() : null;
    if (phone && !isValidPhonePk(phone)) {
      throw new ApiError(400, "Enter a valid Pakistani mobile number.");
    }
    updates.phone = phone ? normalizePhonePk(phone) : null;
  }
  if (payload.photo !== undefined) {
    const photo = payload.photo ? String(payload.photo).trim() : null;
    updates.photo = photo || null;
  }
  if (payload.gender !== undefined) updates.gender = payload.gender || null;
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No changes to save.");
  }
  await user.update(updates);
  const json = user.toJSON();
  delete json.password;
  return json;
}

async function removeStaffUser(actor, userId) {
  const user = await Users.findOne({
    where: { id: userId, fkSchoolId: actor.schoolId },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (!STAFF_ROLES.includes(user.role)) {
    throw new ApiError(400, "Only staff accounts can be removed here.");
  }
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "Super admin accounts cannot be deleted.");
  }
  if (actor.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, "Only the super admin can remove non-teaching staff.");
  }
  if (user.role === USER_ROLES.TEACHER) {
    const teacher = await Teachers.findOne({
      where: { fkUserId: user.id, fkSchoolId: actor.schoolId },
    });
    if (teacher) {
      const classLinks = await TeacherClasses.count({
        where: { fkTeacherId: teacher.id },
      });
      const slotLinks = await TimetableSlots.count({
        where: { fkTeacherId: teacher.id, fkSchoolId: actor.schoolId },
      });
      if (classLinks > 0 || slotLinks > 0) {
        throw new ApiError(
          400,
          "Cannot delete this teacher while they are assigned to classes. Remove timetable and class assignments first.",
        );
      }
      await teacher.destroy();
    }
  }
  await user.destroy();
  return { deleted: true };
}

async function resendInvitation(actor, userId) {
  const user = await Users.findOne({
    where: { id: userId, fkSchoolId: actor.schoolId },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (!STAFF_ROLES.includes(user.role)) {
    throw new ApiError(400, "Invitations can only be resent for staff accounts.");
  }
  if (actor.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, "Only the super admin can resend invitations for non-teachers.");
  }
  await authService.sendUserInvitation(user, user.role);
  return { sent: true, email: user.email };
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
  updateStaffUser,
  removeStaffUser,
  resendInvitation,
};
