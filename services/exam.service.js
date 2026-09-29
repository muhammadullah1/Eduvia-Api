"use strict";

const {
  MarkSheets,
  MarkSheetRows,
  FeePayments,
  sequelize,
} = require("../models");
const { SHEET_STATUS, PAYMENT_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { classId, status } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (status) where.status = status;
  return MarkSheets.findAll({
    where,
    include: [{ model: MarkSheetRows, as: "rows" }],
    order: [["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await MarkSheets.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: MarkSheetRows, as: "rows" }],
  });
  if (!row) throw new ApiError(404, "Mark sheet not found");
  return row;
}

async function create(schoolId, data) {
  const { rows = [], ...rest } = data;
  return sequelize.transaction(async (t) => {
    const sheet = await MarkSheets.create(
      { ...rest, fkSchoolId: schoolId, status: SHEET_STATUS.DRAFT },
      { transaction: t },
    );
    if (rows.length) {
      await MarkSheetRows.bulkCreate(
        rows.map((r) => ({
          fkMarkSheetId: sheet.id,
          fkStudentId: r.studentId || r.fkStudentId,
          score: r.score ?? null,
        })),
        { transaction: t },
      );
    }
    return getById(sheet.id, schoolId);
  });
}

async function updateRows(id, schoolId, rows) {
  const sheet = await getById(id, schoolId);
  if (sheet.status === SHEET_STATUS.PUBLISHED) {
    throw new ApiError(400, "Cannot edit a published mark sheet");
  }
  return sequelize.transaction(async (t) => {
    for (const r of rows) {
      const studentId = r.studentId || r.fkStudentId;
      const [row] = await MarkSheetRows.findOrCreate({
        where: { fkMarkSheetId: id, fkStudentId: studentId },
        defaults: { score: r.score ?? null },
        transaction: t,
      });
      await row.update({ score: r.score ?? null }, { transaction: t });
    }
    return getById(id, schoolId);
  });
}

async function studentHasPaidFee(schoolId, studentId, feePeriod) {
  if (!feePeriod) return true;
  const paid = await FeePayments.findOne({
    where: {
      fkSchoolId: schoolId,
      fkStudentId: studentId,
      period: feePeriod,
      status: PAYMENT_STATUS.PAID,
    },
  });
  return Boolean(paid);
}

/**
 * Publish with fee gate:
 * - If fee_period is set, unpaid students are blocked (visibleToParent=false, blockedByFee=true)
 *   unless manualOverride is already set.
 * - Sheet status still becomes Published; parents only see rows with visibleToParent=true.
 */
async function publish(id, schoolId) {
  const sheet = await getById(id, schoolId);
  if (sheet.status !== SHEET_STATUS.VERIFIED && sheet.status !== SHEET_STATUS.PUBLISHED) {
    // allow Verified → Published; also idempotent republish to re-evaluate gates
    if (sheet.status !== SHEET_STATUS.VERIFIED) {
      throw new ApiError(400, "Only verified sheets can be published");
    }
  }
  return sequelize.transaction(async (t) => {
    for (const row of sheet.rows) {
      if (row.manualOverride) {
        await row.update(
          { blockedByFee: false, visibleToParent: true },
          { transaction: t },
        );
        continue;
      }
      const feeOk = await studentHasPaidFee(schoolId, row.fkStudentId, sheet.feePeriod);
      await row.update(
        {
          blockedByFee: !feeOk,
          visibleToParent: feeOk,
        },
        { transaction: t },
      );
    }
    await sheet.update({ status: SHEET_STATUS.PUBLISHED }, { transaction: t });
    return getById(id, schoolId);
  });
}

async function setStatus(id, schoolId, status) {
  if (status === SHEET_STATUS.PUBLISHED) {
    return publish(id, schoolId);
  }
  const allowed = Object.values(SHEET_STATUS);
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid sheet status");
  const sheet = await getById(id, schoolId);
  await sheet.update({ status });
  return getById(id, schoolId);
}

async function overrideFeeGate(sheetId, schoolId, { studentId, reason, userId }) {
  if (!reason || !String(reason).trim()) {
    throw new ApiError(400, "Override reason is required");
  }
  const sheet = await getById(sheetId, schoolId);
  const row = sheet.rows.find((r) => r.fkStudentId === Number(studentId));
  if (!row) throw new ApiError(404, "Mark sheet row not found for student");
  await row.update({
    manualOverride: true,
    overrideReason: String(reason).trim(),
    overrideByUserId: userId,
    blockedByFee: false,
    visibleToParent: sheet.status === SHEET_STATUS.PUBLISHED,
  });
  return getById(sheetId, schoolId);
}

module.exports = {
  list,
  getById,
  create,
  updateRows,
  setStatus,
  publish,
  overrideFeeGate,
  studentHasPaidFee,
};
