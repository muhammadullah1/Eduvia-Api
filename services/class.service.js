"use strict";

const { Op } = require("sequelize");
const { Classes, Students, TimetableSlots } = require("../models");
const ApiError = require("../utils/ApiError");
// Lazy: fee_structure.service -> audit.service would otherwise load during this module's init.
const feeStructureService = () => require("./fee_structure.service");
const { sortClasses } = require("../utils/class_order");

function isArchivedClass(row) {
  if (!row) return false;
  const archivedAt =
    row.deletedAt ??
    (typeof row.get === "function" ? row.get("archived_at") : null) ??
    row.archived_at;
  return Boolean(archivedAt);
}

async function assertNoActiveDuplicate(schoolId, sessionId, grade, section, excludeId) {
  const where = {
    fkSchoolId: schoolId,
    fkSessionId: sessionId,
    grade,
    section,
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const active = await Classes.findOne({ where });
  if (active) {
    throw new ApiError(
      409,
      "A class with this name already exists in the current session.",
    );
  }
}

/** Students who still belong to a class (not withdrawn, struck off or graduated). */
const ENROLLED = { status: { [Op.notIn]: ["Withdrawn", "StruckOff", "Graduated"] } };

function enrolledCount(classId, transaction) {
  return Students.count({ where: { fkClassId: classId, ...ENROLLED }, transaction });
}

/**
 * Class status is derived: Active while it has enrolled students, Inactive
 * when it has none. Archived (deleted) classes are left alone. Call this
 * inside the transaction that moved students in or out.
 */
async function syncClassStatus(classIds, transaction) {
  const ids = [...new Set([].concat(classIds).filter(Boolean).map(Number))].sort((a, b) => a - b);
  for (const id of ids) {
    // Row lock (in id order) so concurrent moves out of one class count after each
    // other. NO KEY UPDATE doesn't clash with the FK share locks student writes take.
    const row = await Classes.findByPk(id, { transaction, lock: transaction ? transaction.LOCK.NO_KEY_UPDATE : undefined });
    if (!row || row.status === "Archived") continue;
    const next = (await enrolledCount(id, transaction)) > 0 ? "Active" : "Inactive";
    if (row.status !== next) await row.update({ status: next }, { transaction });
  }
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function attachStats(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const sequelize = Classes.sequelize;

  const studentRows = await Students.findAll({
    attributes: [
      "fkClassId",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    where: {
      fkClassId: { [Op.in]: ids },
      ...ENROLLED,
    },
    group: ["fkClassId"],
    raw: true,
  });

  const subjectRows = await TimetableSlots.findAll({
    attributes: [
      "fkClassId",
      [
        sequelize.fn(
          "COUNT",
          sequelize.fn("DISTINCT", sequelize.col("fk_subject_id")),
        ),
        "count",
      ],
    ],
    where: { fkClassId: { [Op.in]: ids } },
    group: ["fkClassId"],
    raw: true,
  });

  const studentsByClass = new Map(
    studentRows.map((row) => [row.fkClassId, Number(row.count) || 0]),
  );
  const subjectsByClass = new Map(
    subjectRows.map((row) => [row.fkClassId, Number(row.count) || 0]),
  );

  return rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : { ...row };
    json.studentCount = studentsByClass.get(row.id) ?? 0;
    json.subjectCount = subjectsByClass.get(row.id) ?? 0;
    return json;
  });
}

/** Attach the Tuition in force as `monthlyFee` (a virtual attribute) to each class row. */
async function withFees(rows) {
  const amounts = await feeStructureService().currentTuitionByClass(rows);
  for (const row of rows) row.setDataValue("monthlyFee", amounts.get(row.id) ?? 0);
  return rows;
}

async function withFee(row) {
  await withFees([row]);
  return row;
}

async function list(schoolId, { sessionId, includeStats, archived } = {}) {
  const where = { fkSchoolId: schoolId };
  if (sessionId) where.fkSessionId = sessionId;

  if (archived) {
    where.archived_at = { [Op.ne]: null };
    const rows = sortClasses(await withFees(await Classes.findAll({ where, paranoid: false })));
    if (!includeStats) return rows;
    return attachStats(rows);
  }

  const rows = sortClasses(await withFees(await Classes.findAll({ where })));
  if (!includeStats) return rows;
  return attachStats(rows);
}

async function getById(id, schoolId) {
  const row = await Classes.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Class not found");
  return row;
}

async function create(schoolId, data) {
  const { fkSessionId, grade, section } = data;
  await assertNoActiveDuplicate(schoolId, fkSessionId, grade, section);
  const archived = await Classes.findOne({
    where: { fkSchoolId: schoolId, fkSessionId, grade, section },
    paranoid: false,
  });
  if (isArchivedClass(archived)) {
    throw new ApiError(
      409,
      `A class named "${grade}" is already in the archive for this session. Restore it from Settings → Archives instead of creating a new one.`,
    );
  }
  // A new class has no students yet, so it starts Inactive.
  const fields = { ...data };
  delete fields.monthlyFee;
  const row = await Classes.create({ ...fields, fkSchoolId: schoolId, status: "Inactive" });
  // The class form's fee becomes the class's first Tuition row (fee structure is the source of truth).
  if (Number(data.monthlyFee) > 0) await feeStructureService().recordClassFee(row, Number(data.monthlyFee), { isNew: true });
  return withFee(row);
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  const grade = data.grade ?? row.grade;
  const section = data.section ?? row.section;
  const sessionId = data.fkSessionId ?? row.fkSessionId;

  if (data.grade !== undefined || data.section !== undefined || data.fkSessionId !== undefined) {
    await assertNoActiveDuplicate(schoolId, sessionId, grade, section, id);
  }

  // Status follows enrolment (syncClassStatus); it is never set by hand.
  const changes = { ...data };
  delete changes.status;
  delete changes.monthlyFee;
  // Validate the structure lock before mutating the class row; recordClassFee skips an unchanged amount.
  if (data.monthlyFee !== undefined) await feeStructureService().recordClassFee(row, Number(data.monthlyFee));
  await row.update(changes);
  return withFee(row);
}

async function remove(id, schoolId) {
  const row = await getById(id, schoolId);
  const count = await enrolledCount(row.id);
  if (count > 0) {
    throw new ApiError(
      409,
      `${row.label} has ${plural(count, "enrolled student")}. Move or withdraw them before deleting the class.`,
    );
  }
  await row.update({ status: "Archived" });
  await row.destroy();
  return true;
}

async function restore(id, schoolId) {
  const row = await Classes.findOne({
    where: { id, fkSchoolId: schoolId },
    paranoid: false,
  });
  if (!row) throw new ApiError(404, "Class not found");
  if (!isArchivedClass(row)) {
    throw new ApiError(400, "This class is already active.");
  }

  await assertNoActiveDuplicate(
    schoolId,
    row.fkSessionId,
    row.grade,
    row.section,
  );

  await row.restore();
  await row.update({ status: (await enrolledCount(row.id)) > 0 ? "Active" : "Inactive" });
  return withFee(row);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  restore,
  syncClassStatus,
  enrolledCount,
};
