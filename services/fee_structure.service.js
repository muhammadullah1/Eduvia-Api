"use strict";

const { Op } = require("sequelize");
const { FeeStructures, Classes, AcademicSessions, Users, sequelize } = require("../models");
const ApiError = require("../utils/ApiError");
const { today } = require("../utils/dates");
const auditService = require("./audit.service");
const { FEE_TYPES, FEE_TYPE_FREQUENCY } = require("../constants/finance");

/**
 * Fee structure per class (Finance Step 3).
 *
 * Rows are never edited in place: a fee change adds a row with a new
 * effective_from, and removing a fee type archives its live rows with a reason.
 * A month is billed with the latest live row whose effective_from is on or
 * before the 1st of that month. classes.monthly_tuition_fee is kept equal to
 * the tuition in force this month so older screens and the fallback agree.
 */

const monthStart = (month) => `${String(month).slice(0, 7)}-01`;
const money = (value) => Math.round(Number(value) * 100) / 100;
const userName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : null);

async function classFor(schoolId, classId, transaction) {
  const klass = await Classes.findOne({ where: { id: classId, fkSchoolId: schoolId }, transaction });
  if (!klass) throw new ApiError(404, "Class not found");
  return klass;
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

/** Tuition billed for `month` (YYYY-MM), or null when the class has no live tuition row for it. */
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

/** The class's structure today, plus any amounts scheduled to start later. */
async function forClass(schoolId, classId, { asOf } = {}) {
  const klass = await classFor(schoolId, classId);
  const day = asOf || today();
  const current = await inForce(klass.id, day);
  const upcomingRows = await FeeStructures.findAll({
    where: { fkClassId: klass.id, effectiveFrom: { [Op.gt]: day } },
    order: [["effectiveFrom", "ASC"]],
  });
  const fees = FEE_TYPES.filter((t) => current.has(t)).map((t) => plain(current.get(t)));
  const total = (list) => money(list.reduce((sum, f) => sum + f.amount, 0));
  const session = await AcademicSessions.findByPk(klass.fkSessionId, { attributes: ["id", "name", "isCurrent"] });
  return {
    class: { id: klass.id, label: klass.label, sessionId: klass.fkSessionId, sessionName: session?.name ?? null },
    asOf: day,
    fees,
    upcoming: upcomingRows.map(plain),
    monthlyTotal: total(fees.filter((f) => f.frequency === "Monthly")),
    otherTotal: total(fees.filter((f) => f.frequency !== "Monthly")),
  };
}

/** Every amount a fee type has had for the class (live and removed), newest first. */
async function history(schoolId, classId, feeType) {
  const klass = await classFor(schoolId, classId);
  const day = today();
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

/** Keep classes.monthly_tuition_fee equal to the tuition in force this month (0 = no tuition row). */
async function syncClassFee(klass, transaction) {
  const amount = (await tuitionForMonth(klass.id, today(), { transaction })) ?? 0;
  if (Number(klass.monthlyTuitionFee) !== amount) {
    await Classes.update({ monthlyTuitionFee: amount }, { where: { id: klass.id }, transaction, hooks: false });
  }
}

/** Add a fee type, or a new amount for an existing type from `effectiveFrom`. */
async function add(actor, classId, { feeType, amount, effectiveFrom }) {
  return sequelize.transaction(async (transaction) => {
    const klass = await classFor(actor.schoolId, classId, transaction);
    const clash = await FeeStructures.findOne({ where: { fkClassId: klass.id, feeType, effectiveFrom }, transaction });
    if (clash) {
      throw new ApiError(409, `${feeType} already has an amount starting ${effectiveFrom}. Pick another effective date.`);
    }
    const previous = (await inForce(klass.id, effectiveFrom, { transaction, feeType })).get(feeType);
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
        : `added ${feeType} (${amount}) for ${klass.label} effective ${effectiveFrom}`,
      {
        entityType: "fee_structure",
        entityId: row.id,
        metadata: { classId: klass.id, feeType, amount, effectiveFrom, previousAmount: previous ? Number(previous.amount) : null },
      },
      { transaction },
    );
    return plain(row);
  });
}

/** Remove a fee type from the class: archive every live row (history keeps them) and record why. */
async function remove(actor, classId, feeType, reason) {
  return sequelize.transaction(async (transaction) => {
    const klass = await classFor(actor.schoolId, classId, transaction);
    const rows = await FeeStructures.findAll({ where: { fkClassId: klass.id, feeType }, transaction });
    if (!rows.length) throw new ApiError(404, `${klass.label} has no ${feeType} fee`);
    const inForceRow = (await inForce(klass.id, today(), { transaction, feeType })).get(feeType);
    const ids = rows.map((r) => r.id);
    await FeeStructures.update({ removedReason: reason, fkRemovedByUserId: actor.id ?? null }, { where: { id: ids }, transaction });
    await FeeStructures.destroy({ where: { id: ids }, transaction });
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
 * The class fee was set from the class form (create / edit). Record it as a
 * Tuition row starting this month (or the session start for a new class) so
 * fee_structures stays the source of truth. Same date twice: the newer replaces it.
 */
async function recordClassFee(klass, { actor = null, isNew = false, transaction } = {}) {
  const amount = Number(klass.monthlyTuitionFee);
  let effectiveFrom = monthStart(today());
  if (isNew) {
    const session = await AcademicSessions.findByPk(klass.fkSessionId, { transaction });
    if (session?.startDate) effectiveFrom = String(session.startDate).slice(0, 10);
  }
  const current = await tuitionForMonth(klass.id, effectiveFrom, { transaction });
  if (current === amount || (current === null && amount <= 0)) return null;
  const same = await FeeStructures.findOne({ where: { fkClassId: klass.id, feeType: "Tuition", effectiveFrom }, transaction });
  if (same) {
    await same.update({ removedReason: "Replaced from the class form" }, { transaction });
    await same.destroy({ transaction });
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

module.exports = { inForce, forClass, history, add, remove, tuitionForMonth, recordClassFee, monthStart };
