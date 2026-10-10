"use strict";

const { Students, Classes, Parents, Users, StudentStatusEvents, StudentPromotions, StudentFeeMonths, AcademicSessions, sequelize } = require("../models");
const { STUDENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

/**
 * `scope` narrows rows for restricted roles: parents get their linked
 * children only, teachers the classes they teach (see access.service).
 */
async function list(schoolId, { classId, status, page = 1, pageSize = 50 } = {}, scope = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (scope.studentIds) where.id = scope.studentIds;
  if (scope.classIds) where.fkClassId = classId ? scope.classIds.filter((id) => id === Number(classId)) : scope.classIds;
  if (status) where.status = status;
  const limit = Math.min(Number(pageSize) || 50, 1000);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const { rows, count } = await Students.findAndCountAll({
    where,
    include: [{ model: Classes, as: "class", attributes: ["id", "label", "grade", "section"] }],
    order: [["lastName", "ASC"], ["firstName", "ASC"]],
    limit,
    offset,
  });
  return { rows, count, page: Number(page) || 1, pageSize: limit };
}

async function getById(id, schoolId) {
  const row = await Students.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [
      { model: Classes, as: "class" },
      {
        model: Parents,
        as: "parents",
        through: { attributes: ["isPrimary"] },
        include: [{ model: Users, as: "user", attributes: { exclude: ["password"] } }],
      },
      { model: StudentStatusEvents, as: "statusEvents" },
      {
        model: StudentPromotions,
        as: "promotions",
        include: [
          { model: Classes, as: "fromClass", attributes: ["id", "label"] },
          { model: Classes, as: "toClass", attributes: ["id", "label"] },
        ],
      },
    ],
  });
  if (!row) throw new ApiError(404, "Student not found");
  return row;
}

async function create(schoolId, data) {
  return Students.create({ ...data, fkSchoolId: schoolId });
}

async function update(id, schoolId, data) {
  if (data.status) {
    throw new ApiError(400, "Record a status change with a reason and a date");
  }
  const row = await getById(id, schoolId);
  await row.update(data);
  return getById(id, schoolId);
}

async function outstandingOf(studentId, transaction) {
  const months = await StudentFeeMonths.findAll({ where: { fkStudentId: studentId }, transaction });
  return months.reduce((sum, month) => sum + Math.max(0, Number(month.getDataValue("netAmount")) - Number(month.getDataValue("paidAmount"))), 0);
}

async function changeStatus(actor, id, { status, reason, effectiveOn, finalResult, academicStatus }) {
  if (!Object.values(STUDENT_STATUS).includes(status)) throw new ApiError(400, "Invalid student status");
  if (!String(reason || "").trim()) throw new ApiError(400, "A reason is required");
  if (!effectiveOn) throw new ApiError(400, "A date is required");
  if (status === STUDENT_STATUS.GRADUATED && !String(finalResult || "").trim()) {
    throw new ApiError(400, "Graduation requires the final result");
  }
  if (status === STUDENT_STATUS.STRUCK_OFF && !String(academicStatus || "").trim()) {
    throw new ApiError(400, "Strike-off requires the academic status");
  }
  const student = await Students.findOne({ where: { id, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  if (student.status === status) throw new ApiError(400, "The student already has that status");
  const previous = student.status;
  const session = await AcademicSessions.findOne({ where: { fkSchoolId: actor.schoolId, isCurrent: true } });
  const financial = status === STUDENT_STATUS.STRUCK_OFF
    ? `Outstanding ${(await outstandingOf(student.id)).toFixed(2)}`
    : null;
  await sequelize.transaction(async (transaction) => {
    await StudentStatusEvents.create({
      fkSchoolId: actor.schoolId,
      fkStudentId: student.id,
      fromStatus: previous,
      toStatus: status,
      reason: String(reason).trim(),
      effectiveOn,
      fkActorUserId: actor.id,
      fkClassId: student.fkClassId,
      fkSessionId: session ? session.id : null,
      finalResult: finalResult || null,
      academicStatus: academicStatus || null,
      financialStatus: financial,
    }, { transaction });
    await student.update({ status }, { transaction });
    await auditService.record(actor, `changed student #${student.id} status from ${previous} to ${status}`, {
      entityType: "student",
      entityId: student.id,
      metadata: { from: previous, to: status, reason, effectiveOn, finalResult, academicStatus, financial },
    }, { transaction });
  });
  return getById(id, actor.schoolId);
}

async function promote(actor, id, { classId, sessionId, date }) {
  if (!date) throw new ApiError(400, "A promotion date is required");
  const student = await Students.findOne({ where: { id, fkSchoolId: actor.schoolId } });
  if (!student) throw new ApiError(404, "Student not found");
  const session = sessionId
    ? await AcademicSessions.findOne({ where: { id: sessionId, fkSchoolId: actor.schoolId } })
    : await AcademicSessions.findOne({ where: { fkSchoolId: actor.schoolId, isCurrent: true } });
  if (!session) throw new ApiError(404, "Session not found");
  const nextClass = await Classes.findOne({ where: { id: classId, fkSchoolId: actor.schoolId, fkSessionId: session.id } });
  if (!nextClass) throw new ApiError(404, "Class not found in that session");
  if (nextClass.id === student.fkClassId) throw new ApiError(400, "Choose a different class");
  if (nextClass.capacity != null) {
    const seated = await Students.count({ where: { fkClassId: nextClass.id, status: STUDENT_STATUS.ACTIVE } });
    if (seated >= Number(nextClass.capacity)) throw new ApiError(409, "Class is at capacity");
  }
  const previousClassId = student.fkClassId;
  await sequelize.transaction(async (transaction) => {
    await StudentPromotions.create({
      fkSchoolId: actor.schoolId,
      fkStudentId: student.id,
      fkFromClassId: previousClassId,
      fkToClassId: nextClass.id,
      fkSessionId: session.id,
      promotedOn: date,
      fkActorUserId: actor.id,
    }, { transaction });
    await student.update({ fkClassId: nextClass.id }, { transaction });
    await auditService.record(actor, `promoted student #${student.id} to class #${nextClass.id}`, {
      entityType: "student",
      entityId: student.id,
      metadata: { fromClassId: previousClassId, toClassId: nextClass.id, sessionId: session.id, date },
    }, { transaction });
  });
  return getById(id, actor.schoolId);
}

async function remove(id, schoolId) {
  const row = await Students.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Student not found");
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, remove, changeStatus, promote };
