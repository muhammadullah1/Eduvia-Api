"use strict";

const {
  StudentFeeMonths,
  StudentFeeMonthAdjustments,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const { feeMonthStatus, cents, fromCents } = require("../utils/fee_allocation");
const { today } = require("../utils/dates");
const monthStamp = (value) => String(value).slice(0, 7);

const round2 = (n) => fromCents(cents(n));

async function loadMonth(schoolId, feeMonthId, transaction) {
  const month = await StudentFeeMonths.findOne({
    where: { id: feeMonthId, fkSchoolId: schoolId },
    transaction,
  });
  if (!month) throw new ApiError(404, "Fee month not found");
  return month;
}

function plain(row) {
  return {
    id: row.id,
    feeMonthId: row.fkFeeMonthId,
    studentId: row.fkStudentId,
    deltaCollectible: Number(row.deltaCollectible),
    reason: row.reason,
    status: row.status,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
  };
}

/** Create a pending adjustment (SA). Does not change the bill until approved. */
async function request(actor, feeMonthId, { deltaCollectible, reason }) {
  return sequelize.transaction(async (transaction) => {
    const month = await loadMonth(actor.schoolId, feeMonthId, transaction);
    const delta = round2(deltaCollectible);
    if (!delta) throw new ApiError(400, "Adjustment delta must be non-zero");
    if (!reason || String(reason).trim().length < 5) throw new ApiError(400, "Reason is required");

    const proposed = round2(Number(month.collectibleAmount) + delta);
    if (proposed < 0) throw new ApiError(400, "Collectible amount cannot go below zero");
    if (cents(proposed) < cents(month.paidAmount)) {
      throw new ApiError(409, "Adjustment would reduce collectible below the amount already paid", {
        code: "ADJUSTMENT_BELOW_PAID",
        paidAmount: Number(month.paidAmount),
        proposedCollectible: proposed,
      });
    }

    const row = await StudentFeeMonthAdjustments.create(
      {
        fkSchoolId: actor.schoolId,
        fkFeeMonthId: month.id,
        fkStudentId: month.fkStudentId,
        deltaCollectible: delta,
        reason: String(reason).trim(),
        status: "PendingApproval",
        fkRequestedByUserId: actor.id,
      },
      { transaction },
    );
    await auditService.record(
      actor,
      `requested fee adjustment ${delta} on bill ${month.id}`,
      { entityType: "fee_month_adjustment", entityId: row.id, metadata: { feeMonthId: month.id, delta } },
      { transaction },
    );
    return plain(row);
  });
}

async function approve(actor, adjustmentId) {
  return sequelize.transaction(async (transaction) => {
    const adj = await StudentFeeMonthAdjustments.findOne({
      where: { id: adjustmentId, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!adj) throw new ApiError(404, "Adjustment not found");
    if (adj.status !== "PendingApproval") throw new ApiError(400, "Only pending adjustments can be approved");

    const month = await loadMonth(actor.schoolId, adj.fkFeeMonthId, transaction);
    const originalNet = Number(month.netAmount);
    const newTotal = round2(Number(month.adjustmentTotal) + Number(adj.deltaCollectible));
    const newCollectible = round2(originalNet + newTotal);

    if (newCollectible < 0) throw new ApiError(400, "Collectible amount cannot go below zero");
    if (cents(newCollectible) < cents(month.paidAmount)) {
      throw new ApiError(409, "Adjustment would reduce collectible below the amount already paid", {
        code: "ADJUSTMENT_BELOW_PAID",
        paidAmount: Number(month.paidAmount),
        proposedCollectible: newCollectible,
      });
    }

    const status = feeMonthStatus(
      {
        amountDue: newCollectible,
        amountPaid: Number(month.paidAmount),
        month: month.month,
      },
      monthStamp(today()),
    );

    await month.update(
      {
        adjustmentTotal: newTotal,
        collectibleAmount: newCollectible,
        status,
      },
      { transaction },
    );
    await adj.update({
      status: "Approved",
      fkApprovedByUserId: actor.id,
      approvedAt: new Date(),
    }, { transaction });

    await auditService.record(
      actor,
      `approved fee adjustment ${adj.deltaCollectible} on bill ${month.id}`,
      {
        entityType: "fee_month_adjustment",
        entityId: adj.id,
        metadata: {
          feeMonthId: month.id,
          originalNet,
          adjustmentTotal: newTotal,
          collectibleAmount: newCollectible,
          paidAmount: Number(month.paidAmount),
        },
      },
      { transaction },
    );
    return {
      adjustment: plain(adj),
      feeMonth: {
        id: month.id,
        netAmount: originalNet,
        adjustmentTotal: newTotal,
        collectibleAmount: newCollectible,
        paidAmount: Number(month.paidAmount),
        status,
      },
    };
  });
}

async function reject(actor, adjustmentId, reason) {
  return sequelize.transaction(async (transaction) => {
    const adj = await StudentFeeMonthAdjustments.findOne({
      where: { id: adjustmentId, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!adj) throw new ApiError(404, "Adjustment not found");
    if (adj.status !== "PendingApproval") throw new ApiError(400, "Only pending adjustments can be rejected");
    if (!reason || String(reason).trim().length < 5) throw new ApiError(400, "Rejection reason required");
    await adj.update({ status: "Rejected", rejectionReason: reason }, { transaction });
    return plain(adj);
  });
}

module.exports = { request, approve, reject };
