"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
  Applications,
  ApplicationDocuments,
  Students,
  Classes,
  AcademicSessions,
  Users,
  Parents,
  StudentParents,
  sequelize,
} = require("../models");
const {
  APPLICATION_STATUS,
  APPLICATION_DECISION,
  STUDENT_STATUS,
  USER_ROLES,
  USER_STATUS,
  SETTING_KEYS,
} = require("../constants");
const ApiError = require("../utils/ApiError");
const settingsService = require("./settings.service");
const feeService = require("./fee.service");
const auditService = require("./audit.service");

const RELATIONS = new Set(["Father", "Mother", "Guardian"]);

async function list(schoolId, { status } = {}) {
  const where = { fkSchoolId: schoolId };
  if (status) where.status = status;
  return Applications.findAll({
    where,
    include: [{ model: ApplicationDocuments, as: "documents" }],
    order: [["created_at", "DESC"], ["id", "DESC"]],
  });
}

async function getById(id, schoolId, options = {}) {
  const row = await Applications.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: ApplicationDocuments, as: "documents" }],
    ...options,
  });
  if (!row) throw new ApiError(404, "Application not found");
  return row;
}

async function columnsFrom(schoolId, data, transaction) {
  const out = {};
  if (data.name != null) {
    const parts = String(data.name).trim().split(/\s+/);
    out.applicantFirstName = parts[0] || data.name;
    out.applicantLastName = parts.slice(1).join(" ") || "-";
  }
  if (data.guardian != null) out.parentName = data.guardian;
  if (data.phone != null) out.parentPhone = data.phone;
  if (data.email != null) out.parentEmail = String(data.email).trim().toLowerCase();
  if (data.dob != null) out.dateOfBirth = data.dob;
  for (const key of [
    "gender",
    "address",
    "previousSchool",
    "previousClass",
    "guardianRelation",
    "guardianAddress",
    "interviewType",
    "interviewDate",
    "interviewScore",
    "interviewResult",
    "notes",
    "submittedOn",
    "fkClassId",
  ]) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  if (data.fkClassId) {
    const klass = await Classes.findOne({ where: { id: data.fkClassId, fkSchoolId: schoolId }, transaction });
    if (!klass) throw new ApiError(404, "Class not found");
    out.gradeApplyingFor = klass.label;
    out.fkClassId = klass.id;
  }
  return out;
}

async function currentSessionId(schoolId, transaction) {
  const session = await AcademicSessions.findOne({ where: { fkSchoolId: schoolId, isCurrent: true }, transaction });
  if (!session) throw new ApiError(400, "No current academic session");
  return session.id;
}

async function create(schoolId, data) {
  const { documents = [] } = data;
  return sequelize.transaction(async (t) => {
    const columns = await columnsFrom(schoolId, data, t);
    if (!columns.fkClassId) throw new ApiError(400, "Class applied for is required");
    if (!columns.dateOfBirth) throw new ApiError(400, "Date of birth is required");
    if (!columns.gender) throw new ApiError(400, "Gender is required");
    const app = await Applications.create(
      {
        ...columns,
        fkSchoolId: schoolId,
        fkSessionId: await currentSessionId(schoolId, t),
        status: APPLICATION_STATUS.NEW,
        submittedOn: columns.submittedOn || new Date().toISOString().slice(0, 10),
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
    return getById(app.id, schoolId, { transaction: t });
  });
}

async function update(id, schoolId, data) {
  const row = await getById(id, schoolId);
  const { documents } = data;
  await row.update(await columnsFrom(schoolId, data));
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
  if (row.status === APPLICATION_STATUS.ENROLLED) {
    throw new ApiError(400, "An enrolled application cannot be decided again");
  }
  let status = APPLICATION_STATUS.REVIEW;
  if (decision === APPLICATION_DECISION.REJECT) status = APPLICATION_STATUS.REJECTED;
  if (decision === APPLICATION_DECISION.WAITLIST) status = APPLICATION_STATUS.WAITLIST;
  await row.update({ decision, status });
  return getById(id, schoolId);
}

async function nextAdmissionNo(schoolId, transaction) {
  const { prefix, digits } = await settingsService.get(schoolId, SETTING_KEYS.ADMISSION, { transaction });
  const width = Number(digits) || 4;
  const head = prefix || "CLS";
  const existing = await Students.findAll({
    where: { fkSchoolId: schoolId, admissionNo: { [Op.like]: `${head}%` } },
    attributes: ["admissionNo"],
    transaction,
  });
  const pattern = new RegExp(`^${head}(\\d+)$`);
  let max = 0;
  for (const student of existing) {
    const match = pattern.exec(student.admissionNo);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${head}${String(max + 1).padStart(width, "0")}`;
}

async function linkGuardian(schoolId, app, student, transaction) {
  const email = app.parentEmail && String(app.parentEmail).trim().toLowerCase();
  if (!email) throw new ApiError(400, "Guardian email is required to enroll");
  const relation = RELATIONS.has(app.guardianRelation) ? app.guardianRelation : "Guardian";
  let user = await Users.findOne({ where: { email, fkSchoolId: schoolId }, transaction });
  let parent;
  let createdUser = null;
  if (user) {
    if (user.role !== USER_ROLES.PARENT) {
      throw new ApiError(409, "Guardian email belongs to a staff account");
    }
    parent = await Parents.findOne({ where: { fkUserId: user.id, fkSchoolId: schoolId }, transaction });
    if (!parent) {
      parent = await Parents.create(
        { fkUserId: user.id, fkSchoolId: schoolId, primaryContactNumber: app.parentPhone },
        { transaction },
      );
    }
  } else {
    const parts = String(app.parentName || "Guardian").trim().split(/\s+/);
    const hashed = await bcrypt.hash(crypto.randomBytes(18).toString("hex"), 10);
    user = await Users.create(
      {
        fkSchoolId: schoolId,
        firstName: parts[0] || "Guardian",
        lastName: parts.slice(1).join(" ") || "-",
        email,
        phone: app.parentPhone,
        password: hashed,
        role: USER_ROLES.PARENT,
        status: USER_STATUS.ACTIVE,
      },
      { transaction },
    );
    parent = await Parents.create(
      {
        fkUserId: user.id,
        fkSchoolId: schoolId,
        primaryContactNumber: app.parentPhone,
        ...(relation === "Father" ? { fatherName: app.parentName } : {}),
        ...(relation === "Mother" ? { motherName: app.parentName } : {}),
      },
      { transaction },
    );
    createdUser = user;
  }
  await StudentParents.findOrCreate({
    where: { fkParentId: parent.id, fkStudentId: student.id },
    defaults: { relationshipType: relation, isPrimary: true },
    transaction,
  });
  return createdUser;
}

async function enroll(id, schoolId, { admissionNo } = {}, actor) {
  const app = await getById(id, schoolId);
  if (app.status === APPLICATION_STATUS.ENROLLED || app.enrolledStudentId) {
    throw new ApiError(400, "Application is already enrolled");
  }
  if (app.decision !== APPLICATION_DECISION.ADMIT) {
    throw new ApiError(400, "Application must have Admit decision before enroll");
  }
  if (!app.fkClassId) throw new ApiError(400, "Application has no class");

  const createdParent = await sequelize.transaction(async (t) => {
    const klass = await Classes.findOne({ where: { id: app.fkClassId, fkSchoolId: schoolId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!klass) throw new ApiError(404, "Class not found");
    if (klass.capacity != null) {
      const seated = await Students.count({
        where: { fkClassId: klass.id, fkSchoolId: schoolId, status: STUDENT_STATUS.ACTIVE },
        transaction: t,
      });
      if (seated >= Number(klass.capacity)) throw new ApiError(409, "Class is at capacity");
    }

    const nameParts = String(app.name).trim().split(/\s+/);
    const student = await Students.create(
      {
        fkSchoolId: schoolId,
        fkClassId: klass.id,
        admissionNo: admissionNo || (await nextAdmissionNo(schoolId, t)),
        firstName: nameParts[0] || app.name,
        lastName: nameParts.slice(1).join(" ") || "-",
        gender: app.gender,
        dob: app.dob,
        status: STUDENT_STATUS.ACTIVE,
        admittedOn: new Date().toISOString().slice(0, 10),
      },
      { transaction: t },
    );
    const parentUser = await linkGuardian(schoolId, app, student, t);
    await feeService.openLedger(schoolId, student, t);
    await app.update({ status: APPLICATION_STATUS.ENROLLED, enrolledStudentId: student.id }, { transaction: t });
    if (actor) {
      await auditService.record(
        actor,
        `enrolled ${student.firstName} ${student.lastName} (${student.admissionNo})`,
        { entityType: "student", entityId: student.id, metadata: { applicationId: app.id, classId: klass.id } },
        { transaction: t },
      );
    }
    return parentUser;
  });

  if (createdParent) {
    try {
      const authService = require("./auth.service");
      await authService.sendUserInvitation(createdParent, USER_ROLES.PARENT);
    } catch (err) {
      console.error("Failed to send parent invitation email:", err.message);
    }
  }

  return { application: await getById(id, schoolId), student: await Students.findByPk((await getById(id, schoolId)).enrolledStudentId) };
}

module.exports = { list, getById, create, update, decide, enroll };
