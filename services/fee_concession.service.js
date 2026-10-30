"use strict";

const { Op } = require("sequelize");
const {
  StudentFeeConcessions,
  StudentFeeConcessionEvents,
  SchoolConcessionReasons,
  Students,
  AcademicSessions,
  Classes,
  StudentParents,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");
const accessService = require("./access.service");
const settingsService = require("./settings.service");
const { resolveConcession } = require("../utils/concession_resolve");
const { FEE_TYPES } = require("../constants/finance");
const { SETTING_KEYS } = require("../constants");
const {
  CONCESSION_MODES,
  DEFAULT_CONCESSION_POLICY,
} = require("../constants/concessions");

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
  let reasonLabel = null;
  if (row.reasonRow && row.reasonRow.label) reasonLabel = row.reasonRow.label;
  else if (row.reason) reasonLabel = row.reason;

  return {
    id: row.id,
    schoolId: row.fkSchoolId,
    sessionId: row.fkSessionId,
    studentId: row.fkStudentId,
    reasonId: row.fkReasonId,
    reasonLabel,
    replacesId: row.fkReplacesId,
    feeType: row.feeType || "Tuition",
    feeTypes: [row.feeType || "Tuition"],
    mode: row.mode,
    value: Number(row.value),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    status: row.status,
    notes: row.notes,
    rejectionReason: row.rejectionReason,
    approvedAt: row.approvedAt,
    requestedByUserId: row.fkRequestedByUserId,
    approvedByUserId: row.fkApprovedByUserId,
  };
}

function studentDisplayName(student) {
  if (!student) return null;
  const first = student.firstName || "";
  const last = student.lastName || "";
  return `${first} ${last}`.trim();
}

async function policyFor(schoolId, transaction) {
  const fees = await settingsService.get(schoolId, SETTING_KEYS.FEES, { transaction });
  if (fees.concessionPolicy && typeof fees.concessionPolicy === "object") {
    return { ...DEFAULT_CONCESSION_POLICY, ...fees.concessionPolicy };
  }
  return { ...DEFAULT_CONCESSION_POLICY };
}

function needsApproval(policy, mode, value) {
  const rule = policy.approvalRule || "none";
  if (rule === "always") return true;
  if (rule === "none") return false;
  if (mode === "waiver") return true;
  if (mode === "percent") {
    if (policy.approvalPercentAbove == null) return false;
    return Number(value) > Number(policy.approvalPercentAbove);
  }
  if (mode === "fixed_discount") {
    if (policy.approvalAmountAbove == null) return false;
    return Number(value) > Number(policy.approvalAmountAbove);
  }
  return false;
}

async function load(schoolId, id, transaction) {
  const row = await StudentFeeConcessions.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: SchoolConcessionReasons, as: "reasonRow" }],
    transaction,
  });
  if (!row) throw new ApiError(404, "Concession not found");
  return row;
}

async function assertStudent(schoolId, studentId, transaction) {
  const student = await Students.findOne({
    where: { id: studentId, fkSchoolId: schoolId },
    transaction,
  });
  if (!student) throw new ApiError(404, "Student not found");
  return student;
}

async function sessionForStudent(schoolId, student, bodySessionId, transaction) {
  if (bodySessionId) {
    const session = await AcademicSessions.findOne({
      where: { id: bodySessionId, fkSchoolId: schoolId },
      transaction,
    });
    if (!session) throw new ApiError(404, "Session not found");
    return session;
  }
  if (student.fkClassId) {
    const klass = await Classes.findByPk(student.fkClassId, {
      attributes: ["fkSessionId"],
      transaction,
    });
    if (klass) {
      const session = await AcademicSessions.findByPk(klass.fkSessionId, { transaction });
      if (session) return session;
    }
  }
  const current = await AcademicSessions.findOne({
    where: { fkSchoolId: schoolId, isCurrent: true },
    transaction,
  });
  if (!current) throw new ApiError(400, "No academic session available for this concession");
  return current;
}

/**
 * Upsert-style assign: creates Approved or PendingApproval; supersedes any
 * previous Approved row for the same student + fee type.
 */
async function assign(actor, body) {
  return sequelize.transaction(async (transaction) => {
    const student = await assertStudent(actor.schoolId, body.studentId, transaction);
    const policy = await policyFor(actor.schoolId, transaction);

    const mode = body.mode;
    if (!CONCESSION_MODES.includes(mode)) throw new ApiError(400, "Invalid concession type");
    if (!(policy.allowedModes || []).includes(mode)) {
      throw new ApiError(400, "This concession type is not allowed by school policy");
    }

    let feeType = "Tuition";
    if (body.feeType) feeType = body.feeType;
    if (!FEE_TYPES.includes(feeType)) throw new ApiError(400, "Invalid fee type");

    let value = Number(body.value) || 0;
    if (mode === "waiver") value = 0;
    if (mode === "percent" && (value < 0 || value > 100)) {
      throw new ApiError(400, "Percent must be between 0 and 100");
    }
    if (mode === "fixed_discount" && value < 0) {
      throw new ApiError(400, "Discount amount must be 0 or more");
    }

    let reasonId = null;
    let reasonLabel = null;
    if (body.reasonId) {
      const reason = await SchoolConcessionReasons.findOne({
        where: {
          id: body.reasonId,
          fkSchoolId: actor.schoolId,
          active: true,
        },
        transaction,
      });
      if (!reason) throw new ApiError(404, "Concession reason not found");
      reasonId = reason.id;
      reasonLabel = reason.label;
    } else if (body.reasonLabel) {
      reasonLabel = String(body.reasonLabel).trim();
    }
    if (!reasonLabel) throw new ApiError(400, "Pick a concession reason");

    const session = await sessionForStudent(
      actor.schoolId,
      student,
      body.sessionId,
      transaction,
    );

    let effectiveFrom = body.effectiveFrom;
    if (!effectiveFrom) effectiveFrom = session.startDate;
    let effectiveTo = null;
    if (body.effectiveTo) effectiveTo = body.effectiveTo;

    let notes = null;
    if (body.notes) notes = body.notes;

    const pending = needsApproval(policy, mode, value);
    const status = pending ? "PendingApproval" : "Approved";

    const previous = await StudentFeeConcessions.findOne({
      where: {
        fkSchoolId: actor.schoolId,
        fkStudentId: student.id,
        feeType,
        status: "Approved",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let replacesId = null;
    if (previous && !pending) {
      replacesId = previous.id;
      await previous.update({ status: "Superseded" }, { transaction });
      await recordEvent(
        previous.id,
        "Superseded",
        "Approved",
        "Superseded",
        actor,
        { by: "new_version" },
        transaction,
      );
    }

    const row = await StudentFeeConcessions.create(
      {
        fkSchoolId: actor.schoolId,
        fkSessionId: session.id,
        fkStudentId: student.id,
        fkReasonId: reasonId,
        fkReplacesId: replacesId,
        feeType,
        category: "Standard",
        mode,
        value,
        priority: 100,
        stackable: false,
        effectiveFrom,
        effectiveTo,
        status,
        reason: reasonLabel,
        notes,
        fkRequestedByUserId: actor.id,
        fkApprovedByUserId: pending ? null : actor.id,
        approvedAt: pending ? null : new Date(),
      },
      { transaction },
    );

    await recordEvent(row.id, "Created", null, status, actor, { feeType, mode, value }, transaction);
    if (!pending) {
      await auditService.record(
        actor,
        `set ${feeType} concession for student ${student.id} (${mode})`,
        { entityType: "fee_concession", entityId: row.id },
        { transaction },
      );
    }

    return plain(await load(actor.schoolId, row.id, transaction));
  });
}

/** @deprecated Prefer assign — kept for older clients that POSTed drafts. */
async function create(actor, body) {
  return assign(actor, body);
}

async function approve(actor, id) {
  return sequelize.transaction(async (transaction) => {
    const row = await load(actor.schoolId, id, transaction);
    if (row.status !== "PendingApproval") {
      throw new ApiError(400, "Only pending concessions can be approved");
    }

    const previous = await StudentFeeConcessions.findOne({
      where: {
        fkSchoolId: actor.schoolId,
        fkStudentId: row.fkStudentId,
        feeType: row.feeType,
        status: "Approved",
        id: { [Op.ne]: row.id },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (previous) {
      await previous.update({ status: "Superseded" }, { transaction });
      await recordEvent(
        previous.id,
        "Superseded",
        "Approved",
        "Superseded",
        actor,
        { by: "approval" },
        transaction,
      );
      await row.update({ fkReplacesId: previous.id }, { transaction });
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

async function listForStudent(user, studentId) {
  await accessService.assertStudentAccess(user, studentId);
  const rows = await StudentFeeConcessions.findAll({
    where: { fkSchoolId: user.schoolId, fkStudentId: studentId },
    include: [{ model: SchoolConcessionReasons, as: "reasonRow" }],
    order: [["id", "DESC"]],
  });
  return rows.map(plain);
}

async function list(user, { status, sessionId, studentId } = {}) {
  const where = { fkSchoolId: user.schoolId };
  if (status) where.status = status;
  if (sessionId) where.fkSessionId = sessionId;
  if (studentId) where.fkStudentId = studentId;

  const scope = await accessService.studentScope(user);
  if (scope) {
    if (!scope.length) return [];
    if (studentId) {
      const allowed = scope.includes(Number(studentId));
      if (!allowed) throw new ApiError(403, "This student is not linked to your account.");
    } else {
      where.fkStudentId = { [Op.in]: scope };
    }
  }

  const rows = await StudentFeeConcessions.findAll({
    where,
    include: [
      { model: SchoolConcessionReasons, as: "reasonRow" },
      {
        model: Students,
        as: "student",
        attributes: ["id", "firstName", "lastName", "admissionNo"],
      },
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

async function resolveForBill(schoolId, student, feeType, base, onDate, { transaction } = {}) {
  const amount = Number(base);
  if (!(amount > 0)) {
    return {
      conflict: false,
      discount: 0,
      net: 0,
      snapshot: {
        conflict: false,
        applied: [],
        feeType,
        base: amount > 0 ? amount : null,
      },
    };
  }

  const row = await StudentFeeConcessions.findOne({
    where: {
      fkSchoolId: schoolId,
      fkStudentId: student.id,
      feeType,
      status: "Approved",
      effectiveFrom: { [Op.lte]: onDate },
      [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gte]: onDate } }],
    },
    include: [{ model: SchoolConcessionReasons, as: "reasonRow" }],
    order: [["id", "DESC"]],
    transaction,
  });

  let concession = null;
  if (row) {
    concession = {
      id: row.id,
      mode: row.mode,
      value: Number(row.value),
      fkReasonId: row.fkReasonId,
      reasonLabel: row.reasonRow ? row.reasonRow.label : row.reason,
      reason: row.reason,
    };
  }

  const resolved = resolveConcession(amount, concession);
  return {
    ...resolved,
    snapshot: {
      conflict: false,
      applied: resolved.applied,
      feeType,
      base: amount,
      reasonLabel: concession ? concession.reasonLabel : null,
      mode: concession ? concession.mode : null,
      value: concession ? concession.value : null,
      net: resolved.net,
      discount: resolved.discount,
    },
  };
}

async function get(user, id) {
  const row = await load(user.schoolId, id);
  await accessService.assertStudentAccess(user, row.fkStudentId);
  return plain(row);
}

/** Suggest Sibling reason when another student in the same school shares a parent. */
async function siblingSuggestion(user, studentId) {
  await accessService.assertStudentAccess(user, studentId);
  const links = await StudentParents.findAll({
    where: { fkStudentId: studentId },
    attributes: ["fkParentId"],
  });
  if (!links.length) return { suggestSibling: false, siblingStudentIds: [] };

  const parentIds = links.map((l) => l.fkParentId);
  const peers = await StudentParents.findAll({
    where: {
      fkParentId: { [Op.in]: parentIds },
      fkStudentId: { [Op.ne]: studentId },
    },
    include: [
      {
        model: Students,
        as: "student",
        where: { fkSchoolId: user.schoolId },
        attributes: ["id", "firstName", "lastName", "admissionNo"],
        required: true,
      },
    ],
  });

  const seen = new Set();
  const siblings = [];
  for (const peer of peers) {
    if (!peer.student || seen.has(peer.student.id)) continue;
    seen.add(peer.student.id);
    siblings.push({
      id: peer.student.id,
      name: studentDisplayName(peer.student),
      admissionNo: peer.student.admissionNo,
    });
  }
  return {
    suggestSibling: siblings.length > 0,
    siblingStudentIds: siblings.map((s) => s.id),
    siblings,
  };
}

async function submit() {
  throw new ApiError(410, "Submit is no longer used — assign creates Approved or PendingApproval directly");
}

module.exports = {
  assign,
  create,
  submit,
  approve,
  reject,
  revoke,
  list,
  listForStudent,
  get,
  resolveForBill,
  siblingSuggestion,
  plain,
  needsApproval,
  policyFor,
};
