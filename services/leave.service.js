"use strict";

const { StudentLeaveRequests, Students } = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");

function presentIds(ids) {
  return ids.length ? ids : [0];
}

async function list(user, { studentId, status } = {}) {
  const where = { fkSchoolId: user.schoolId };
  if (status) where.status = status;
  if (user.role === USER_ROLES.PARENT) {
    where.fkStudentId = presentIds(await accessService.linkedStudentIds(user));
  } else if (user.role === USER_ROLES.TEACHER) {
    const teacher = await accessService.teacherFor(user);
    const classIds = await accessService.teacherClassIds(teacher);
    where.fkStudentId = presentIds((await Students.findAll({
      where: { fkClassId: classIds.length ? classIds : [0], fkSchoolId: user.schoolId },
      attributes: ["id"],
    })).map((row) => row.id));
  }
  if (studentId) {
    await accessService.assertStudentAccess(user, studentId);
    where.fkStudentId = studentId;
  }
  return StudentLeaveRequests.findAll({
    where,
    include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }],
    order: [["startDate", "DESC"], ["id", "DESC"]],
  });
}

async function create(actor, { studentId, startDate, endDate, reason }) {
  if (!startDate || !endDate) throw new ApiError(400, "Start and end dates are required");
  if (endDate < startDate) throw new ApiError(400, "The end date is before the start date");
  if (!String(reason || "").trim()) throw new ApiError(400, "A reason is required");
  const student = await accessService.assertStudentAccess(actor, studentId);
  return StudentLeaveRequests.create({
    fkSchoolId: actor.schoolId,
    fkStudentId: student.id,
    fkRequestedByUserId: actor.id,
    startDate,
    endDate,
    reason: String(reason).trim(),
    status: "Pending",
  });
}

async function review(actor, id, { status, reviewNotes }) {
  if (!["Approved", "Rejected"].includes(status)) throw new ApiError(400, "Decision must be Approved or Rejected");
  const row = await StudentLeaveRequests.findOne({ where: { id, fkSchoolId: actor.schoolId } });
  if (!row) throw new ApiError(404, "Leave request not found");
  if (row.status !== "Pending") throw new ApiError(400, "This request has already been reviewed");
  await row.update({ status, reviewNotes: reviewNotes || null, fkReviewedByUserId: actor.id });
  return row;
}

module.exports = { list, create, review };
