"use strict";

const { Op } = require("sequelize");
const { Students, Classes, Parents, Users, StudentStatusEvents, StudentPromotions, StudentFeeMonths, AcademicSessions, sequelize } = require("../models");
const { STUDENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { syncClassStatus } = require("./class.service");
const lifecycle = require("./lifecycle.service");
const feeService = require("./fee.service");

/**
 * `scope` narrows rows for restricted roles: parents get their linked
 * children only, teachers the classes they teach (see access.service).
 */
async function list(schoolId, { classId, status, search, page = 1, pageSize = 50 } = {}, scope = {}) {
  const where = { fkSchoolId: schoolId };
  const term = String(search || "").trim();
  if (term) {
    const like = { [Op.iLike]: `%${term}%` };
    where[Op.or] = [{ firstName: like }, { lastName: like }, { admissionNo: like }];
  }
  if (classId) where.fkClassId = classId;
  if (scope.studentIds) where.id = scope.studentIds;
  if (scope.classIds) where.fkClassId = classId ? scope.classIds.filter((id) => id === Number(classId)) : scope.classIds;
  if (status) where.status = status;
  const limit = Math.min(Number(pageSize) || 50, 1000);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const { rows, count } = await Students.findAndCountAll({
    where,
    include: [
      { model: Classes, as: "class", attributes: ["id", "label", "grade", "section"] },
      {
        model: Parents,
        as: "parents",
        attributes: ["id", "guardianName", "fatherName", "motherName", "primaryContactNumber"],
        through: { attributes: ["isPrimary", "relationshipType"] },
        include: [{ model: Users, as: "user", attributes: ["id", "firstName", "lastName", "phone", "email"] }],
      },
    ],
    order: [["lastName", "ASC"], ["firstName", "ASC"]],
    distinct: true,
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
  return sequelize.transaction(async (transaction) => {
    const row = await Students.create({ ...data, fkSchoolId: schoolId }, { transaction });
    await syncClassStatus(row.fkClassId, transaction);
    return row;
  });
}

async function update(id, schoolId, data) {
  if (data.status) {
    throw new ApiError(400, "Record a status change with a reason and a date");
  }
  const row = await getById(id, schoolId);
  const previousClassId = row.fkClassId;
  await sequelize.transaction(async (transaction) => {
    await row.update(data, { transaction });
    // A transfer empties one class and fills another.
    if (row.fkClassId !== previousClassId) await syncClassStatus([previousClassId, row.fkClassId], transaction);
  });
  return getById(id, schoolId);
}

/** Status changes live in lifecycle.service (transition map, SRS fields, audit). */
async function changeStatus(actor, id, input) {
  await lifecycle.changeStatus(actor, id, input);
  return getById(id, actor.schoolId);
}

/**
 * Promote one student (SRS 4.3.3: previous class, new class, session, date,
 * permanent history). Only Active students move (D5: not Inactive); the
 * target class must be in the chosen session and have a free seat.
 */
async function promote(actor, id, { classId, sessionId, date }) {
  if (!date) throw new ApiError(400, "A promotion date is required");
  await sequelize.transaction(async (transaction) => {
    const student = await Students.findOne({ where: { id, fkSchoolId: actor.schoolId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!student) throw new ApiError(404, "Student not found");
    if (student.status !== STUDENT_STATUS.ACTIVE) {
      throw new ApiError(409, `Only Active students can be promoted (this student is ${student.status === "StruckOff" ? "Struck off" : student.status})`);
    }
    lifecycle.assertEffectiveDate(student, date);
    const session = sessionId
      ? await AcademicSessions.findOne({ where: { id: sessionId, fkSchoolId: actor.schoolId }, transaction })
      : await AcademicSessions.findOne({ where: { fkSchoolId: actor.schoolId, isCurrent: true }, transaction });
    if (!session) throw new ApiError(404, "Session not found");
    const nextClass = await Classes.findOne({
      where: { id: classId, fkSchoolId: actor.schoolId, fkSessionId: session.id },
      transaction,
      lock: transaction.LOCK.NO_KEY_UPDATE,
    });
    if (!nextClass) throw new ApiError(404, "Class not found in that session");
    if (nextClass.id === student.fkClassId) throw new ApiError(400, "Choose a different class");
    await lifecycle.assertSeats(nextClass, 1, transaction);
    const previousClassId = student.fkClassId;
    await StudentPromotions.create({
      fkSchoolId: actor.schoolId,
      fkStudentId: student.id,
      fkFromClassId: previousClassId,
      fkToClassId: nextClass.id,
      fkSessionId: session.id,
      promotedOn: date,
      fkActorUserId: actor.id,
      outcome: "Promoted",
    }, { transaction });
    await student.update({ fkClassId: nextClass.id }, { transaction });
    await feeService.billPromotionIfConfigured(actor, student, nextClass, date, transaction);
    await syncClassStatus([previousClassId, nextClass.id], transaction);
    await auditService.record(actor, `promoted student #${student.id} to class #${nextClass.id}`, {
      entityType: "student",
      entityId: student.id,
      metadata: { fromClassId: previousClassId, toClassId: nextClass.id, sessionId: session.id, date },
    }, { transaction });
  });
  return getById(id, actor.schoolId);
}

/** Lifecycle history is permanent: only a Pending student with no history can be removed. */
async function remove(id, schoolId) {
  await sequelize.transaction(async (transaction) => {
    const row = await Students.findOne({ where: { id, fkSchoolId: schoolId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new ApiError(404, "Student not found");
    const [events, promotions, months] = await Promise.all([
      StudentStatusEvents.count({ where: { fkStudentId: row.id }, transaction }),
      StudentPromotions.count({ where: { fkStudentId: row.id }, transaction }),
      StudentFeeMonths.count({ where: { fkStudentId: row.id }, transaction }),
    ]);
    if (row.status !== STUDENT_STATUS.PENDING || events || promotions || months) {
      throw new ApiError(409, "This student has lifecycle or fee history and cannot be deleted. Change their status instead.");
    }
    await row.destroy({ transaction });
    await syncClassStatus(row.fkClassId, transaction);
  });
  return true;
}

module.exports = { list, getById, create, update, remove, changeStatus, promote };
