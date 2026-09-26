"use strict";

const { FeePayments, Students } = require("../models");
const ApiError = require("../utils/ApiError");
const crypto = require("crypto");

async function list(schoolId, { studentId, status } = {}) {
  const where = { fkSchoolId: schoolId };
  if (studentId) where.fkStudentId = studentId;
  if (status) where.status = status;
  return FeePayments.findAll({
    where,
    include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }],
    order: [["paidOn", "DESC"], ["id", "DESC"]],
  });
}

async function create(schoolId, data) {
  const student = await Students.findOne({
    where: { id: data.fkStudentId, fkSchoolId: schoolId },
  });
  if (!student) throw new ApiError(404, "Student not found");
  return FeePayments.create({
    ...data,
    fkSchoolId: schoolId,
    ref: data.ref || `FEE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  });
}

module.exports = { list, create };
