"use strict";

const { Op } = require("sequelize");
const { FeeStructures, Classes, AcademicSessions, Users, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const { today } = require("../utils/dates");
const auditService = require("./audit.service");
const { FEE_TYPES, FEE_TYPE_FREQUENCY } = require("../constants/finance");

/**
 * Fee structure per class.
 *
 * Policy: configure freely before the academic session starts. Once
 * today >= session.start_date the structure is locked, except a one-time
 * bootstrap when no live row exists for that fee type. Before lock, at most
 * one live row per (class, feeType); superseding archives prior live rows.
 * Billing still uses effective_from history (inForce) for already-stored rows.
 */

const monthStart = (month) => `${String(month).slice(0, 7)}-01`;
const money = (value) => Math.round(Number(value) * 100) / 100;
const userName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : null);
const dayOf = (value) => String(value).slice(0, 10);

async function classFor(schoolId, classId, transaction) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: schoolId }, transaction });
  if (!klass) throw new ApiError(404, "Class not found");
  return klass;
}

async function sessionForClass(klass, transaction) {
  const session = await AcademicSessions.findByPk(klass.fkSessionId, { transaction });
  if (!session) throw new ApiError(404, "Academic session not found");
  return session;
}

function sessionLocked(session, asOf = today()) {
  return dayOf(asOf) >= dayOf(session.startDate);
}

async function hasLiveRow(classId, feeType, transaction) {
  const n = await FeeStructures.count({ where: { fkClassId: classId, feeType }, transaction });
  return n > 0;
}

/** Live row with amount > 0. Amount 0 means "not configured" and stays bootstrap-editable. */
async function hasConfiguredLiveRow(classId, feeType, transaction) {
  const n = await FeeStructures.count({
    where: {
      fkClassId: classId,
      feeType,
      amount: { [Op.gt]: 0 },
    },
    transaction,
  });
  return n > 0;
}

async function assertWritable(session, classId, feeType, transaction) {
  if (!sessionLocked(session)) return { bootstrap: false };
  const configured = await hasConfiguredLiveRow(classId, feeType, transaction);
  if (configured) {
    throw new ApiError(409, "Fee structure for this session is locked and cannot be changed.", {
      code: "FEE_STRUCTURE_SESSION_LOCKED",
      feeType,
    });
  }
  return { bootstrap: true };
}

/** Soft-remove every live row of a type (pre-session supersede or remove). */
async function archiveLive(classId, feeType, { reason, userId, transaction }) {
  const rows = await FeeStructures.findAll({ where: { fkClassId: classId, feeType }, transaction });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  await FeeStructures.update(
    { removedReason: reason, fkRemovedByUserId: userId ?? null },
    { where: { id: ids }, transaction },
  );
  await FeeStructures.destroy({ where: { id: ids }, transaction });
  return rows;
}

/** Latest live row per fee type in force on `onDay` (YYYY-MM-DD). */
async function inForce(classId, onDay, { transaction, feeType } = {}) {
  const rows = await FeeStructures.findAll({
    where: { fkClassId: classId, effectiveFrom: { [Op.lte]: onDay }, ...(feeType ? { feeType } : {}) },
    order: [["effectiveFrom", "DESC"], ["id", "DESC"]],
    transaction,
  });
  const byType = new Map();
  for (const row of rows) if (!byType.has(row.feeType)) byType.set(row.feeType, row);
  return byType;
}

async function tuitionForMonth(classId, month, { transaction } = {}) {
  const row = (await inForce(classId, monthStart(month), { transaction, feeType: "Tuition" })).get("Tuition");
  return row ? Number(row.amount) : null;
}

const plain = (row) => ({
  id: row.id,
  feeType: row.feeType,
  frequency: row.frequency,
  amount: Number(row.amount),
  effectiveFrom: row.effectiveFrom,
});

async function forClass(schoolId, classId, { asOf } = {}) {
  const klass = await classFor(schoolId, classId);
  const session = await sessionForClass(klass);
  // Future sessions: show amounts that will be in force at session start (not empty "upcoming-only").
  const lockedNow = sessionLocked(session, today());
  const day = asOf || (lockedNow ? today() : dayOf(session.startDate));
  const locked = sessionLocked(session, today());
  const current = await inForce(klass.id, day);
  const configuredTypes = new Set();
  const liveRows = await FeeStructures.findAll({
    where: { fkClassId: klass.id },
    attributes: ["feeType", "amount"],
  });
  for (const row of liveRows) {
    if (Number(row.amount) > 0) configuredTypes.add(row.feeType);
  }
  const upcomingRows = await FeeStructures.findAll({
    where: { fkClassId: klass.id, effectiveFrom: { [Op.gt]: day } },
    order: [["effectiveFrom", "ASC"]],
  });
  const fees = FEE_TYPES.filter((t) => current.has(t)).map((t) => plain(current.get(t)));
  const total = (list) => money(list.reduce((sum, f) => sum + f.amount, 0));
  const bootstrapEligible = locked ? FEE_TYPES.filter((t) => !configuredTypes.has(t)) : [];
  return {
    class: { id: klass.id, label: klass.label, sessionId: klass.fkSessionId, sessionName: session?.name ?? null },
    asOf: day,
    sessionStartDate: dayOf(session.startDate),
    sessionLocked: locked,
    editable: !locked,
    bootstrapEligible,
    fees,
    upcoming: upcomingRows.map(plain),
    monthlyTotal: total(fees.filter((f) => f.frequency === "Monthly")),
    otherTotal: total(fees.filter((f) => f.frequency !== "Monthly")),
  };
}

async function history(schoolId, classId, feeType) {
  const klass = await classFor(schoolId, classId);
  const session = await sessionForClass(klass);
  // Mark "Current" using session start for future sessions so pre-start config is visible.
  const day = sessionLocked(session) ? today() : dayOf(session.startDate);
  const rows = await FeeStructures.findAll({
    where: { fkClassId: klass.id, feeType },
    paranoid: false,
    include: [
      { model: Users, as: "updatedBy", attributes: ["id", "firstName", "lastName", "email"] },
      { model: Users, as: "removedBy", attributes: ["id", "firstName", "lastName", "email"] },
    ],
    order: [["effectiveFrom", "DESC"], ["id", "DESC"]],
  });
  const currentId = (await inForce(klass.id, day, { feeType })).get(feeType)?.id ?? null;
  return {
    feeType,
    entries: rows.map((row) => ({
      ...plain(row),
      status: row.isSoftDeleted() ? "Removed" : row.id === currentId ? "Current" : row.effectiveFrom > day ? "Scheduled" : "Past",
      addedAt: row.createdAt,
      addedBy: userName(row.updatedBy),
      removedAt: row.isSoftDeleted() ? row.getDataValue("archived_at") ?? row.getDataValue("archivedAt") : null,
      removedBy: userName(row.removedBy),
      removedReason: row.removedReason,
    })),
  };
}

async function syncClassFee(klass, transaction) {
  const amount = (await tuitionForMonth(klass.id, today(), { transaction })) ?? 0;
  if (Number(klass.monthlyTuitionFee) !== amount) {
    await Classes.update({ monthlyTuitionFee: amount }, { where: { id: klass.id }, transaction, hooks: false });
  }
}

/**
 * Add or supersede a fee type. Server always uses session.start_date as effective_from.
 * Client effectiveFrom is ignored when present.
 */
async function add(actor, classId, { feeType, amount }) {
  return sequelize.transaction(async (transaction) => {
    const klass = await classFor(actor.schoolId, classId, transaction);
    const session = await sessionForClass(klass, transaction);
    const { bootstrap } = await assertWritable(session, klass.id, feeType, transaction);
    const effectiveFrom = dayOf(session.startDate);

    const previous = (await inForce(klass.id, effectiveFrom, { transaction, feeType })).get(feeType);
    if (!bootstrap && !sessionLocked(session)) {
      await archiveLive(klass.id, feeType, {
        reason: "Superseded before session start",
        userId: actor.id,
        transaction,
      });
    } else if (bootstrap) {
      // Replace amount-0 / missing setup rows so initial lock-time setup can stick.
      await archiveLive(klass.id, feeType, {
        reason: "Initial setup after session start",
        userId: actor.id,
        transaction,
      });
    }

    const row = await FeeStructures.create(
      {
        fkSchoolId: actor.schoolId,
        fkSessionId: klass.fkSessionId,
        fkClassId: klass.id,
        feeType,
        frequency: FEE_TYPE_FREQUENCY[feeType],
        amount,
        effectiveFrom,
        fkUpdatedByUserId: actor.id ?? null,
      },
      { transaction },
    );
    if (feeType === "Tuition") await syncClassFee(klass, transaction);
    await auditService.record(
      actor,
      previous
        ? `changed ${feeType} for ${klass.label} from ${Number(previous.amount)} to ${amount} effective ${effectiveFrom}`
        : bootstrap
          ? `bootstrapped ${feeType} (${amount}) for ${klass.label} after session start`
          : `added ${feeType} (${amount}) for ${klass.label} effective ${effectiveFrom}`,
      {
        entityType: "fee_structure",
        entityId: row.id,
        metadata: {
          classId: klass.id,
          feeType,
          amount,
          effectiveFrom,
          previousAmount: previous ? Number(previous.amount) : null,
          bootstrap,
          sessionLocked: sessionLocked(session),
        },
      },
      { transaction },
    );
    return plain(row);
  });
}

async function remove(actor, classId, feeType, reason) {
  return sequelize.transaction(async (transaction) => {
    const klass = await classFor(actor.schoolId, classId, transaction);
    const session = await sessionForClass(klass, transaction);
    if (sessionLocked(session)) {
      throw new ApiError(409, "Fee structure for this session is locked and cannot be changed.", {
        code: "FEE_STRUCTURE_SESSION_LOCKED",
        feeType,
      });
    }
    const rows = await FeeStructures.findAll({ where: { fkClassId: klass.id, feeType }, transaction });
    if (!rows.length) throw new ApiError(404, `${klass.label} has no ${feeType} fee`);
    const inForceRow = (await inForce(klass.id, today(), { transaction, feeType })).get(feeType);
    await archiveLive(klass.id, feeType, { reason, userId: actor.id, transaction });
    if (feeType === "Tuition") await syncClassFee(klass, transaction);
    await auditService.record(
      actor,
      `removed ${feeType}${inForceRow ? ` (${Number(inForceRow.amount)})` : ""} from ${klass.label}: ${reason}`,
      { entityType: "fee_structure", entityId: inForceRow?.id ?? rows[0].id, metadata: { classId: klass.id, feeType, reason, rows: rows.length } },
      { transaction },
    );
    return { feeType, removed: rows.length };
  });
}

/**
 * Class form path. Uses session start as effective_from. Honours session lock
 * with Tuition bootstrap when no live Tuition row exists.
 */
async function recordClassFee(klass, { actor = null, isNew = false, transaction } = {}) {
  const amount = Number(klass.monthlyTuitionFee);
  const session = await AcademicSessions.findByPk(klass.fkSessionId, { transaction });
  if (!session) return null;
  const effectiveFrom = dayOf(session.startDate);
  const current = await tuitionForMonth(klass.id, effectiveFrom, { transaction });
  if (current === amount || (current === null && amount <= 0)) return null;

  const locked = sessionLocked(session);
  const configured = await hasConfiguredLiveRow(klass.id, "Tuition", transaction);
  const live = await hasLiveRow(klass.id, "Tuition", transaction);

  if (locked && configured) {
    throw new ApiError(409, "Fee structure for this session is locked and cannot be changed.", {
      code: "FEE_STRUCTURE_SESSION_LOCKED",
      feeType: "Tuition",
    });
  }
  if (locked && !configured && amount <= 0) return null;

  if ((!locked && live) || (locked && live && !configured)) {
    await archiveLive(klass.id, "Tuition", {
      reason: isNew ? "Replaced from the class form" : "Superseded before session start",
      userId: actor?.id,
      transaction,
    });
  } else {
    const same = await FeeStructures.findOne({
      where: { fkClassId: klass.id, feeType: "Tuition", effectiveFrom },
      transaction,
    });
    if (same) {
      await same.update({ removedReason: "Replaced from the class form" }, { transaction });
      await same.destroy({ transaction });
    }
  }

  return FeeStructures.create(
    {
      fkSchoolId: klass.fkSchoolId,
      fkSessionId: klass.fkSessionId,
      fkClassId: klass.id,
      feeType: "Tuition",
      frequency: "Monthly",
      amount,
      effectiveFrom,
      fkUpdatedByUserId: actor?.id ?? null,
    },
    { transaction },
  );
}

module.exports = {
  inForce,
  forClass,
  history,
  add,
  remove,
  tuitionForMonth,
  recordClassFee,
  monthStart,
  sessionLocked,
};
