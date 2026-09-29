"use strict";

const { FeePayments, Students } = require("../models");
const ApiError = require("../utils/ApiError");
const crypto = require("crypto");

async function list(schoolId, { studentId, status, period } = {}) {
  const where = { fkSchoolId: schoolId };
  if (studentId) where.fkStudentId = studentId;
  if (status) where.status = status;
  if (period) where.period = period;
  return FeePayments.findAll({
    where,
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "firstName", "lastName", "admissionNo"],
      },
    ],
    order: [["paidOn", "DESC"], ["id", "DESC"]],
  });
}

/**
 * Fee-adding fields aligned with parent portal view:
 * student, period, type, amount, method, status, paidOn/date, ref, dueDate, notes.
 */
async function create(schoolId, data) {
  const student = await Students.findOne({
    where: { id: data.fkStudentId, fkSchoolId: schoolId },
  });
  if (!student) throw new ApiError(404, "Student not found");
  return FeePayments.create({
    ...data,
    fkSchoolId: schoolId,
    ref: data.ref || `FEE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    paidOn: data.paidOn || data.date || null,
  });
}

async function updateStatus(id, schoolId, status) {
  const row = await FeePayments.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Payment not found");
  await row.update({
    status,
    paidOn: status === "Paid" ? row.paidOn || new Date().toISOString().slice(0, 10) : row.paidOn,
  });
  return row;
}

module.exports = { list, create, updateStatus };
