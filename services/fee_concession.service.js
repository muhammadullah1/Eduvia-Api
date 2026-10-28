"use strict";

const { Op } = require("sequelize");
const {
  StudentFeeConcessions,
  StudentFeeConcessionFeeTypes,
  StudentFeeConcessionEvents,
  Students,
  Families,
  FamilyMembers,
  AcademicSessions,
  Classes,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const feeTypePolicyService = require("./fee_type_policy.service");
const { resolveConcessions } = require("../utils/concession_resolve");
const { FEE_TYPES } = require("../constants/finance");

const MODES = ["fixed_payable", "fixed_discount", "percent", "waiver"];
const CATEGORIES = ["Standard", "Scholarship", "Sibling", "Other"];

async function recordEvent(concessionId, eventType, fromStatus, toStatus, actor, payload, transaction) {
  let actorId = null;
  if (actor && actor.id != null) actorId = actor.id;
  await StudentFeeConcessionEvents.create(
    {
      fkConcessionId: concessionId,
      eventType,
      fromStatus,
      toStatus,
      fkActorUserId: actorId,
      payload: payload || null,
    },
    { transaction },
  );
}

function plain(row) {
  let maxDiscountAmount = null;
  if (row.maxDiscountAmount != null) {
    maxDiscountAmount = Number(row.maxDiscountAmount);
  }
  const feeTypeRows = row.feeTypes || [];
  return {
    id: row.id,
    schoolId: row.fkSchoolId,
    sessionId: row.fkSessionId,
    studentId: row.fkStudentId,
    familyId: row.fkFamilyId,
    category: row.category,
    mode: row.mode,
    value: Number(row.value),
    priority: row.priority,
    stackable: row.stackable,
    maxDiscountAmount,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    feeTypes: feeTypeRows.map((t) => t.feeType),
    approvedAt: row.approvedAt,
  };
}

function studentDisplayName(student) {
  if (!student) return null;
  const first = student.firstName || "";
  const last = student.lastName || "";
  return `${first} ${last}`.trim();
}

async function load(schoolId, id, transaction) {
  const row = await StudentFeeConcessions.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: StudentFeeConcessionFeeTypes, as: "feeTypes" }],
    transaction,
  });
  if (!row) throw new ApiError(404, "Concession not found");
  return row;
}

async function assertStudent(schoolId, studentId, transaction) {
  const student = await Students.findOne({ where: { id: studentId, fkSchoolId: schoolId }, transaction });
  if (!student) throw new ApiError(404, "Student not found");
  return student;
}

async function assertFamilyBeneficiary(schoolId, familyId, studentId, transaction) {
  const family = await Families.findOne({ where: { id: familyId, fkSchoolId: schoolId }, transaction });
  if (!family) throw new ApiError(404, "Family not found");
  if (!family.verifiedAt) {
    throw new ApiError(400, "Family must be verified before sibling concessions can be approved", {
      code: "FAMILY_NOT_VERIFIED",
    });
  }
  const member = await FamilyMembers.findOne({
    where: { fkFamilyId: familyId, fkStudentId: studentId, status: "Active" },
    transaction,
  });
  if (!member) throw new ApiError(400, "Student is not an active member of this family");
  return family;
}

async function create(actor, body) {
  return sequelize.transaction(async (transaction) => {
    const student = await assertStudent(actor.schoolId, body.studentId, transaction);
    if (!MODES.includes(body.mode)) throw new ApiError(400, "Invalid concession mode");

    let category = "Standard";
    if (body.category) category = body.category;
    if (!CATEGORIES.includes(category)) throw new ApiError(400, "Invalid category");

    const feeTypes = [...new Set(body.feeTypes || [])];
    if (!feeTypes.length || feeTypes.some((t) => !FEE_TYPES.includes(t))) {
      throw new ApiError(400, "Select at least one valid fee type");
    }
    if (body.mode === "percent" && (body.value < 0 || body.value > 100)) {
      throw new ApiError(400, "Percent must be between 0 and 100");
    }
    const session = await AcademicSessions.findOne({
      where: { id: body.sessionId, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!session) throw new ApiError(404, "Session not found");

    if (body.familyId || category === "Sibling") {
      if (!body.familyId) throw new ApiError(400, "Sibling concessions require a familyId");
      const member = await FamilyMembers.findOne({
        where: { fkFamilyId: body.familyId, fkStudentId: student.id, status: "Active" },
        transaction,
      });
      if (!member) throw new ApiError(400, "Student is not an active member of this family");
      const family = await Families.findOne({
        where: { id: body.familyId, fkSchoolId: actor.schoolId },
        transaction,
      });
      if (!family) throw new ApiError(404, "Family not found");
    }

    let value = body.value;
    if (body.mode === "waiver") value = 100;

    let priority = 100;
    if (body.priority != null) priority = body.priority;

    let maxDiscountAmount = null;
    if (body.maxDiscountAmount != null) maxDiscountAmount = body.maxDiscountAmount;

    let familyId = null;
    if (body.familyId) familyId = body.familyId;

    let effectiveTo = null;
    if (body.effectiveTo) effectiveTo = body.effectiveTo;

    let reason = null;
    if (body.reason) reason = body.reason;

    let notes = null;
    if (body.notes) notes = body.notes;

    const row = await StudentFeeConcessions.create(
      {
        fkSchoolId: actor.schoolId,
        fkSessionId: session.id,
        fkStudentId: student.id,
        fkFamilyId: familyId,
        category,
        mode: body.mode,
        value,
        priority,
        stackable: Boolean(body.stackable),
        maxDiscountAmount,
        effectiveFrom: body.effectiveFrom,
        effectiveTo,
        status: "Draft",
        reason,
        notes,
        fkRequestedByUserId: actor.id,
      },
      { transaction },
    );
    await StudentFeeConcessionFeeTypes.bulkCreate(
      feeTypes.map((feeType) => ({ fkConcessionId: row.id, feeType })),
      { transaction },
    );
    await recordEvent(row.id, "Created", null, "Draft", actor, { feeTypes }, transaction);
    return plain(await load(actor.schoolId, row.id, transaction));
  });
}

async function submit(actor, id) {
  return sequelize.transaction(async (transaction) => {
    const row = await load(actor.schoolId, id, transaction);
    if (!["Draft", "Rejected"].includes(row.status)) {
      throw new ApiError(400, "Only draft or rejected concessions can be submitted");
    }
    if (!row.reason || String(row.reason).trim().length < 5) {
      throw new ApiError(400, "A reason is required before submit");
    }
    const from = row.status;
    await row.update({ status: "PendingApproval", fkRequestedByUserId: actor.id }, { transaction });
    await recordEvent(row.id, "Submitted", from, "PendingApproval", actor, null, transaction);
    return plain(await load(actor.schoolId, id, transaction));
  });
}

async function approve(actor, id) {
  return sequelize.transaction(async (transaction) => {
    const row = await load(actor.schoolId, id, transaction);
    if (row.status !== "PendingApproval") {
      throw new ApiError(400, "Only pending concessions can be approved");
    }
    if (row.fkFamilyId) {
      await assertFamilyBeneficiary(actor.schoolId, row.fkFamilyId, row.fkStudentId, transaction);
    }
    const from = row.status;
    await row.update(
      {
        status: "Approved",
        fkApprovedByUserId: actor.id,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      { transaction },
    );
    await recordEvent(row.id, "Approved", from, "Approved", actor, null, transaction);
    await auditService.record(
      actor,
      `approved fee concession ${row.id} for student ${row.fkStudentId}`,
      { entityType: "fee_concession", entityId: row.id },
      { transaction },
    );
    return plain(await load(actor.schoolId, id, transaction));
  });
}

async function reject(actor, id, reason) {
  return sequelize.transaction(async (transaction) => {
    const row = await load(actor.schoolId, id, transaction);
    if (row.status !== "PendingApproval") {
      throw new ApiError(400, "Only pending concessions can be rejected");
    }
    if (!reason || String(reason).trim().length < 5) {
      throw new ApiError(400, "Rejection reason required");
    }
    const from = row.status;
    await row.update({ status: "Rejected", rejectionReason: reason }, { transaction });
    await recordEvent(row.id, "Rejected", from, "Rejected", actor, { reason }, transaction);
    return plain(await load(actor.schoolId, id, transaction));
  });
}

async function revoke(actor, id, reason) {
  return sequelize.transaction(async (transaction) => {
    const row = await load(actor.schoolId, id, transaction);
    if (row.status !== "Approved") {
      throw new ApiError(400, "Only approved concessions can be revoked");
    }
    if (!reason || String(reason).trim().length < 5) {
      throw new ApiError(400, "Revocation reason required");
    }
    const from = row.status;
    await row.update({ status: "Revoked", rejectionReason: reason }, { transaction });
    await recordEvent(row.id, "Revoked", from, "Revoked", actor, { reason }, transaction);
    await auditService.record(
      actor,
      `revoked fee concession ${row.id}: ${reason}`,
      { entityType: "fee_concession", entityId: row.id },
      { transaction },
    );
    return plain(await load(actor.schoolId, id, transaction));
  });
}

async function listForStudent(schoolId, studentId) {
  await assertStudent(schoolId, studentId);
  const rows = await StudentFeeConcessions.findAll({
    where: { fkSchoolId: schoolId, fkStudentId: studentId },
    include: [{ model: StudentFeeConcessionFeeTypes, as: "feeTypes" }],
    order: [["id", "DESC"]],
  });
  return rows.map(plain);
}

async function list(schoolId, { status, sessionId, studentId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (status) where.status = status;
  if (sessionId) where.fkSessionId = sessionId;
  if (studentId) where.fkStudentId = studentId;
  const rows = await StudentFeeConcessions.findAll({
    where,
    include: [
      { model: StudentFeeConcessionFeeTypes, as: "feeTypes" },
      { model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] },
    ],
    order: [["id", "DESC"]],
    limit: 200,
  });
  return rows.map((row) => {
    let admissionNo = null;
    if (row.student && row.student.admissionNo != null) {
      admissionNo = row.student.admissionNo;
    }
    return {
      ...plain(row),
      studentName: studentDisplayName(row.student),
      admissionNo,
    };
  });
}

/**
 * Resolve concessions for a bill about to be created.
 * Returns { conflict, discount, net, snapshot } — conflict is data, not an exception.
 */
async function resolveForBill(schoolId, student, feeType, base, onDate, { transaction } = {}) {
  const eligible = await feeTypePolicyService.isEligible(schoolId, feeType, { transaction });
  if (!eligible) {
    const resolved = resolveConcessions(base, [], { eligibilityBlocked: true });
    return {
      ...resolved,
      snapshot: { conflict: false, eligibilityBlocked: true, applied: [], feeType, base },
    };
  }

  let sessionId = null;
  if (student.fkClassId) {
    const klass = await Classes.findByPk(student.fkClassId, {
      attributes: ["fkSessionId"],
      transaction,
    });
    if (klass && klass.fkSessionId != null) {
      sessionId = klass.fkSessionId;
    }
  }
  if (!sessionId) {
    const session = await AcademicSessions.findOne({
      where: {
        fkSchoolId: schoolId,
        startDate: { [Op.lte]: onDate },
        endDate: { [Op.gte]: onDate },
      },
      order: [["startDate", "DESC"]],
      transaction,
    });
    if (session) sessionId = session.id;
  }

  const where = {
    fkSchoolId: schoolId,
    fkStudentId: student.id,
    status: "Approved",
    effectiveFrom: { [Op.lte]: onDate },
    [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: onDate } }],
  };
  if (sessionId) where.fkSessionId = sessionId;

  const rows = await StudentFeeConcessions.findAll({
    where,
    include: [
      {
        model: StudentFeeConcessionFeeTypes,
        as: "feeTypes",
        where: { feeType },
        required: true,
      },
    ],
    transaction,
  });

  const resolved = resolveConcessions(base, rows);
  let conflictIds = [];
  if (resolved.conflictIds) conflictIds = resolved.conflictIds;
  return {
    ...resolved,
    snapshot: {
      conflict: resolved.conflict,
      eligibilityBlocked: false,
      applied: resolved.applied,
      conflictIds,
      feeType,
      base,
    },
  };
}

async function get(schoolId, id) {
  return plain(await load(schoolId, id));
}

module.exports = {
  create,
  submit,
  approve,
  reject,
  revoke,
  list,
  listForStudent,
  get,
  resolveForBill,
  plain,
};
