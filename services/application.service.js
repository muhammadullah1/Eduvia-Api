"use strict";

const {
  Applications,
  ApplicationDocuments,
  Students,
  sequelize,
} = require("../models");
const {
  APPLICATION_STATUS,
  APPLICATION_DECISION,
  STUDENT_STATUS,
} = require("../constants");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { status } = {}) {
  const where = { fkSchoolId: schoolId };
  if (status) where.status = status;
  return Applications.findAll({
    where,
    include: [{ model: ApplicationDocuments, as: "documents" }],
    order: [["created_at", "DESC"], ["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await Applications.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: ApplicationDocuments, as: "documents" }],
  });
  if (!row) throw new ApiError(404, "Application not found");
  return row;
}

async function create(schoolId, data) {
  const { documents = [], ...rest } = data;
  return sequelize.transaction(async (t) => {
    const app = await Applications.create(
      {
        ...rest,
        fkSchoolId: schoolId,
        status: APPLICATION_STATUS.NEW,
        submittedOn: rest.submittedOn || new Date().toISOString().slice(0, 10),
      },
      { transaction: t },
    );
    if (documents.length) {
      await ApplicationDocuments.bulkCreate(
        documents.map((d) => ({
          fkApplicationId: app.id,
          label: d.label,
          status: d.status || "Pending",
        })),
        { transaction: t },
      );
    }
    return getById(app.id, schoolId);
  });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  const { documents, ...rest } = data;
  await row.update(rest);
  if (Array.isArray(documents)) {
    for (const doc of documents) {
      if (doc.id) {
        await ApplicationDocuments.update(
          { label: doc.label, status: doc.status },
          { where: { id: doc.id, fkApplicationId: id } },
        );
      } else if (doc.label) {
        await ApplicationDocuments.create({
          fkApplicationId: id,
          label: doc.label,
          status: doc.status || "Pending",
        });
      }
    }
  }
  return getById(id, schoolId);
}

async function decide(id, schoolId, decision) {
  if (!Object.values(APPLICATION_DECISION).includes(decision)) {
    throw new ApiError(400, "Invalid decision");
  }
  const row = await getById(id, schoolId);
  let status = APPLICATION_STATUS.REVIEW;
  if (decision === APPLICATION_DECISION.ADMIT) status = APPLICATION_STATUS.REVIEW;
  if (decision === APPLICATION_DECISION.REJECT) status = APPLICATION_STATUS.REJECTED;
  if (decision === APPLICATION_DECISION.WAITLIST) status = APPLICATION_STATUS.WAITLIST;
  await row.update({ decision, status });
  return getById(id, schoolId);
}

async function enroll(id, schoolId, { admissionNo } = {}) {
  const app = await getById(id, schoolId);
  if (app.decision !== APPLICATION_DECISION.ADMIT && app.status !== APPLICATION_STATUS.WAITLIST) {
    // allow enroll if Admit decision set
  }
  if (app.decision !== APPLICATION_DECISION.ADMIT) {
    throw new ApiError(400, "Application must have Admit decision before enroll");
  }

  return sequelize.transaction(async (t) => {
    const nameParts = String(app.name).trim().split(/\s+/);
    const firstName = nameParts[0] || app.name;
    const lastName = nameParts.slice(1).join(" ") || "-";
    const code =
      admissionNo ||
      `APP-${app.id}-${Date.now().toString().slice(-6)}`;

    const student = await Students.create(
      {
        fkSchoolId: schoolId,
        fkClassId: app.fkClassId,
        admissionNo: code,
        firstName,
        lastName,
        gender: app.gender,
        dob: app.dob,
        status: STUDENT_STATUS.ACTIVE,
        admittedOn: new Date().toISOString().slice(0, 10),
      },
      { transaction: t },
    );

    await app.update(
      { status: APPLICATION_STATUS.ENROLLED },
      { transaction: t },
    );

    return { application: await getById(id, schoolId), student };
  });
}

module.exports = { list, getById, create, update, decide, enroll };
