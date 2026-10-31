"use strict";

const { Op } = require("sequelize");
const {
  Families,
  FamilyMembers,
  Students,
  Parents,
  StudentParents,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");
const auditService = require("./audit.service");

async function getFamily(schoolId, familyId, transaction) {
  const family = await Families.findOne({ where: { id: familyId, fkSchoolId: schoolId }, transaction });
  if (!family) throw new ApiError(404, "Family not found");
  return family;
}

function memberStudentPlain(student) {
  if (!student) return undefined;
  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    admissionNo: student.admissionNo,
  };
}

function plain(family, members = []) {
  return {
    id: family.id,
    displayName: family.displayName,
    primaryParentId: family.fkPrimaryParentId,
    verifiedAt: family.verifiedAt,
    verified: Boolean(family.verifiedAt),
    members: members.map((m) => ({
      id: m.id,
      studentId: m.fkStudentId,
      status: m.status,
      linkedVia: m.linkedVia,
      student: memberStudentPlain(m.student),
    })),
  };
}

/** Sequelize findOrCreate returns [instance, created]; pick the model instance. */
function instanceFromFindOrCreate(result) {
  for (const entry of result) {
    if (entry && typeof entry === "object" && typeof entry.update === "function") {
      return entry;
    }
  }
  return null;
}

async function create(actor, { displayName, primaryParentId = null, studentIds = [] }) {
  return sequelize.transaction(async (transaction) => {
    if (primaryParentId) {
      const parent = await Parents.findOne({
        where: { id: primaryParentId, fkSchoolId: actor.schoolId },
        transaction,
      });
      if (!parent) throw new ApiError(404, "Parent not found");
    }
    const family = await Families.create(
      {
        fkSchoolId: actor.schoolId,
        displayName: String(displayName).trim(),
        fkPrimaryParentId: primaryParentId,
      },
      { transaction },
    );
    for (const studentId of studentIds) {
      await addMember(actor, family.id, { studentId, linkedVia: "manual" }, { transaction, skipAudit: true });
    }
    await auditService.record(
      actor,
      `created family ${family.displayName}`,
      { entityType: "family", entityId: family.id, metadata: { studentIds } },
      { transaction },
    );
    return get(actor.schoolId, family.id, { transaction });
  });
}

async function get(schoolId, familyId, { transaction } = {}) {
  const family = await getFamily(schoolId, familyId, transaction);
  const members = await FamilyMembers.findAll({
    where: { fkFamilyId: family.id },
    include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }],
    transaction,
  });
  return plain(family, members);
}

async function addMember(actor, familyId, { studentId, linkedVia = "manual" }, options = {}) {
  const outer = options.transaction;
  const skipAudit = options.skipAudit;

  const run = async (transaction) => {
    const family = await getFamily(actor.schoolId, familyId, transaction);
    const student = await Students.findOne({
      where: { id: studentId, fkSchoolId: actor.schoolId },
      transaction,
    });
    if (!student) throw new ApiError(404, "Student not found");

    const activeElsewhere = await FamilyMembers.findOne({
      where: { fkStudentId: studentId, status: "Active", fkFamilyId: { [Op.ne]: family.id } },
      transaction,
    });
    if (activeElsewhere) {
      throw new ApiError(409, "Student already belongs to another family", { code: "FAMILY_MEMBER_CONFLICT" });
    }

    const findOrCreateResult = await FamilyMembers.findOrCreate({
      where: { fkFamilyId: family.id, fkStudentId: studentId },
      defaults: { status: "Active", linkedVia },
      transaction,
    });
    const row = instanceFromFindOrCreate(findOrCreateResult);
    if (!row) throw new ApiError(500, "Could not create family membership");

    if (row.status !== "Active") {
      await row.update({ status: "Active", linkedVia }, { transaction });
    }
    if (!skipAudit) {
      await auditService.record(
        actor,
        `added student ${studentId} to family ${family.displayName}`,
        { entityType: "family", entityId: family.id, metadata: { studentId, linkedVia } },
        { transaction },
      );
    }
    return get(actor.schoolId, family.id, { transaction });
  };

  if (outer) return run(outer);
  return sequelize.transaction(run);
}

async function removeMember(actor, familyId, studentId) {
  return sequelize.transaction(async (transaction) => {
    const family = await getFamily(actor.schoolId, familyId, transaction);
    const row = await FamilyMembers.findOne({
      where: { fkFamilyId: family.id, fkStudentId: studentId, status: "Active" },
      transaction,
    });
    if (!row) throw new ApiError(404, "Family member not found");
    await row.update({ status: "Removed" }, { transaction });
    await auditService.record(
      actor,
      `removed student ${studentId} from family ${family.displayName}`,
      { entityType: "family", entityId: family.id, metadata: { studentId } },
      { transaction },
    );
    return get(actor.schoolId, family.id, { transaction });
  });
}

async function verify(actor, familyId) {
  return sequelize.transaction(async (transaction) => {
    const family = await getFamily(actor.schoolId, familyId, transaction);
    await family.update({ verifiedAt: new Date(), fkVerifiedByUserId: actor.id }, { transaction });
    await auditService.record(
      actor,
      `verified family ${family.displayName}`,
      { entityType: "family", entityId: family.id },
      { transaction },
    );
    return get(actor.schoolId, family.id, { transaction });
  });
}

/** Suggestions from shared parent links only — never phone/name alone. */
async function suggestMembers(schoolId, familyId) {
  const family = await getFamily(schoolId, familyId);
  const members = await FamilyMembers.findAll({
    where: { fkFamilyId: family.id, status: "Active" },
    attributes: ["fkStudentId"],
  });
  const memberIds = members.map((m) => m.fkStudentId);
  if (!memberIds.length && !family.fkPrimaryParentId) return [];

  const parentIds = new Set();
  if (family.fkPrimaryParentId) parentIds.add(family.fkPrimaryParentId);
  if (memberIds.length) {
    const links = await StudentParents.findAll({ where: { fkStudentId: memberIds } });
    for (const link of links) parentIds.add(link.fkParentId);
  }
  if (!parentIds.size) return [];

  const excludeStudentIds = memberIds.slice();
  if (!excludeStudentIds.length) {
    // Op.notIn with empty array matches nothing useful; use an impossible id.
    excludeStudentIds.push(-1);
  }

  const siblingLinks = await StudentParents.findAll({
    where: {
      fkParentId: [...parentIds],
      fkStudentId: { [Op.notIn]: excludeStudentIds },
    },
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "firstName", "lastName", "admissionNo", "fkSchoolId"],
      },
    ],
  });

  const seen = new Set();
  const out = [];
  for (const link of siblingLinks) {
    if (!link.student || link.student.fkSchoolId !== schoolId) continue;
    if (seen.has(link.fkStudentId)) continue;
    seen.add(link.fkStudentId);
    out.push({
      studentId: link.fkStudentId,
      firstName: link.student.firstName,
      lastName: link.student.lastName,
      admissionNo: link.student.admissionNo,
      linkedVia: "shared_parent_suggestion",
    });
  }
  return out;
}

async function list(schoolId) {
  const families = await Families.findAll({
    where: { fkSchoolId: schoolId },
    include: [
      {
        model: FamilyMembers,
        as: "members",
        where: { status: "Active" },
        required: false,
        include: [{ model: Students, as: "student", attributes: ["id", "firstName", "lastName", "admissionNo"] }],
      },
    ],
    order: [["id", "DESC"]],
    limit: 200,
  });
  return families.map((f) => {
    const members = f.members || [];
    return plain(f, members);
  });
}

module.exports = { create, get, list, addMember, removeMember, verify, suggestMembers };
