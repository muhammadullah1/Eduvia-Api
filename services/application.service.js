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
const { syncClassStatus } = require("./class.service");
const settingsService = require("./settings.service");
const feeService = require("./fee.service");
const auditService = require("./audit.service");
const storageService = require("./storage.service");
const accessService = require("./access.service");
const { admissionDocumentKeyPattern } = require("./upload_policy.service");
const { hasPermission } = require("./permission.service");
const {
  isValidPhonePk,
  normalizePhonePk,
} = require("../utils/pakistan");
const { resolveAdmissionUiStatus } = require("../utils/admissionUiStatus");
const { interviewDateRange } = require("../utils/dates");

const RELATIONS = new Set(["Father", "Mother", "Guardian", "Other"]);
const PLACEHOLDER_FILE = "pending://local";
const DEFAULT_DOCUMENT_LABELS = [
  "Birth Certificate / B-Form",
  "Previous School Leaving Certificate",
  "Guardian ID Copy (CNIC)",
  "Photographs (2 passport size)",
  "Medical / Vaccination Record",
];

function assertEditable(row) {
  if (row.status === APPLICATION_STATUS.ENROLLED) {
    throw new ApiError(400, "Enrolled applications cannot be edited");
  }
}

function assertSubmitted(row) {
  if (!row.submittedOn) {
    throw new ApiError(400, "Application must be submitted before this action");
  }
}

async function list(
  schoolId,
  { status, q, page = 1, pageSize = 10, submitted, hasInterview, decision } = {},
) {
  const where = { fkSchoolId: schoolId };
  if (status) where.status = status;
  if (decision) where.decision = decision;

  if (submitted === "false" || submitted === false) {
    where.submittedOn = null;
  } else if (submitted === "true" || submitted === true) {
    where.submittedOn = { [Op.ne]: null };
  }

  if (hasInterview === "true" || hasInterview === true) {
    const interviewClause = {
      [Op.or]: [
        { interviewDate: { [Op.ne]: null } },
        { interviewScore: { [Op.ne]: null } },
        { interviewResult: { [Op.ne]: null } },
      ],
    };
    if (where[Op.and]) {
      where[Op.and].push(interviewClause);
    } else {
      where[Op.and] = [interviewClause];
    }
  }

  const term = q && String(q).trim();
  if (term) {
    const searchClause = {
      [Op.or]: [
      { applicantFirstName: { [Op.iLike]: `%${term}%` } },
      { applicantLastName: { [Op.iLike]: `%${term}%` } },
      { parentName: { [Op.iLike]: `%${term}%` } },
      { parentPhone: { [Op.iLike]: `%${term}%` } },
      { gradeApplyingFor: { [Op.iLike]: `%${term}%` } },
      sequelize.where(
        sequelize.fn(
          "concat",
          sequelize.col("applicant_first_name"),
          " ",
          sequelize.col("applicant_last_name"),
        ),
        { [Op.iLike]: `%${term}%` },
      ),
      ],
    };
    if (where[Op.and]) {
      where[Op.and].push(searchClause);
    } else {
      where[Op.and] = [searchClause];
    }
  }

  const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const { rows, count } = await Applications.findAndCountAll({
    where,
    include: [{ model: ApplicationDocuments, as: "documents" }],
    order: [["created_at", "DESC"], ["id", "DESC"]],
    // Count applications, not application × document rows.
    distinct: true,
    col: "id",
    limit,
    offset,
  });

  return { rows, count, page: Number(page) || 1, pageSize: limit };
}

async function getById(id, schoolId, options = {}) {
  const { transaction, lock, ...rest } = options;
  const row = await Applications.findOne({
    where: { id, fkSchoolId: schoolId },
    ...(lock ? { transaction, lock } : { include: [{ model: ApplicationDocuments, as: "documents" }], transaction, ...rest }),
  });
  if (!row) throw new ApiError(404, "Application not found");
  if (lock) {
    return getById(id, schoolId, { transaction });
  }
  return row;
}

async function lockApplication(id, schoolId, transaction) {
  const row = await Applications.findOne({
    where: { id, fkSchoolId: schoolId },
    transaction,
    lock: transaction.LOCK.UPDATE,
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
  if (data.phone != null) {
    const normalized = normalizePhonePk(data.phone);
    if (data.phone && !isValidPhonePk(data.phone)) {
      throw new ApiError(400, "Enter a valid Pakistani mobile number (e.g. 03XX XXXXXXX)");
    }
    out.parentPhone = normalized || data.phone;
  }
  if (data.email != null) out.parentEmail = String(data.email).trim().toLowerCase();
  if (data.dob != null) out.dateOfBirth = data.dob;
  if (data.decision !== undefined) out.decision = data.decision || null;
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
    const klass = await Classes.findOne({
      where: { id: data.fkClassId, fkSchoolId: schoolId },
      transaction,
    });
    if (!klass) throw new ApiError(404, "Class not found");
    out.gradeApplyingFor = klass.label;
    out.fkClassId = klass.id;
  }
  if (data.interviewDate !== undefined && data.interviewDate) {
    const d = String(data.interviewDate).slice(0, 10);
    const { min, max } = interviewDateRange();
    if (d < min || d > max) {
      throw new ApiError(
        400,
        `Interview date must be between ${min} and ${max}`,
      );
    }
    out.interviewDate = d;
  }
  return out;
}

async function currentSessionId(schoolId, transaction) {
  const session = await AcademicSessions.findOne({
    where: { fkSchoolId: schoolId, isCurrent: true },
    transaction,
  });
  if (!session) throw new ApiError(400, "No current academic session");
  return session.id;
}

/**
 * The stored file reference for one document row. Uploaded files are R2
 * object keys under `admissions/<id>/documents/`; a key for any other
 * application is refused so one record can't point at another's file.
 */
function documentFileRef(applicationId, doc, status) {
  if (status === "Pending") return null;
  const value = doc.fileUrl ? String(doc.fileUrl) : "";
  if (!value) return PLACEHOLDER_FILE;
  if (/^(https?|pending):\/\//.test(value)) return value;
  if (!admissionDocumentKeyPattern(applicationId).test(value)) {
    throw new ApiError(400, "That file does not belong to this application.");
  }
  return value;
}

async function syncDocuments(applicationId, documents, transaction) {
  if (!Array.isArray(documents)) return;
  const replaced = [];
  for (const doc of documents) {
    const label = doc.label || doc.title;
    if (!label) continue;
    const status = doc.status || "Pending";
    const fileUrl = documentFileRef(applicationId, doc, status);
    const existing = doc.id
      ? await ApplicationDocuments.findOne({ where: { id: doc.id, fkApplicationId: applicationId }, transaction })
      : null;
    if (existing) {
      if (storageService.isObjectKey(existing.fileUrl) && existing.fileUrl !== fileUrl) replaced.push(existing.fileUrl);
      await existing.update({ title: label, status, fileUrl }, { transaction });
    } else if (!doc.id) {
      await ApplicationDocuments.create(
        { fkApplicationId: applicationId, title: label, status, fileUrl, documentType: doc.documentType || "admission" },
        { transaction },
      );
    }
  }
  if (replaced.length) {
    transaction.afterCommit(() => Promise.all(replaced.map((key) => storageService.deleteObject(key))));
  }
}

async function ensureDefaultDocuments(applicationId, transaction) {
  const existing = await ApplicationDocuments.count({
    where: { fkApplicationId: applicationId },
    transaction,
  });
  if (existing > 0) return;
  await ApplicationDocuments.bulkCreate(
    DEFAULT_DOCUMENT_LABELS.map((label) => ({
      fkApplicationId: applicationId,
      title: label,
      status: "Pending",
      fileUrl: null,
      documentType: "admission",
    })),
    { transaction },
  );
}

function validateForSubmit(row) {
  const missing = [];
  if (!row.applicantFirstName || row.applicantFirstName === "Draft") {
    missing.push("applicant name");
  }
  if (!row.dateOfBirth) missing.push("date of birth");
  if (!row.gender) missing.push("gender");
  if (!row.fkClassId) missing.push("class applied for");
  if (!row.parentName || row.parentName === "Pending") missing.push("guardian");
  if (!row.parentPhone || row.parentPhone === "0000000000") {
    missing.push("guardian phone");
  } else if (!isValidPhonePk(row.parentPhone)) {
    throw new ApiError(400, "Guardian phone must be a valid Pakistani mobile number");
  }
  if (!row.address) missing.push("address");
  if (missing.length) {
    throw new ApiError(400, `Cannot submit: missing ${missing.join(", ")}`);
  }
}

async function statusSummary(schoolId) {
  const rows = await Applications.findAll({
    where: { fkSchoolId: schoolId },
    attributes: [
      "status",
      "submittedOn",
      "interviewDate",
      "interviewScore",
      "interviewResult",
    ],
    raw: true,
  });
  const counts = {
    all: rows.length,
    draft: 0,
    submitted: 0,
    under_review: 0,
    test_interview: 0,
    admitted: 0,
    rejected: 0,
    waitlisted: 0,
    withdrawn: 0,
  };
  for (const row of rows) {
    const bucket = resolveAdmissionUiStatus(row);
    if (counts[bucket] !== undefined) counts[bucket] += 1;
  }
  return counts;
}

/**
 * Short-lived signed link to one admission document. Staff who manage
 * admissions see their own school's files; a parent only sees documents of
 * an application that became their own child. Everyone else gets 403.
 */
async function documentDownloadUrl(user, id, documentId) {
  const app = await Applications.findOne({ where: { id, fkSchoolId: user.schoolId } });
  if (!app) throw new ApiError(404, "Application not found");
  if (user.role === USER_ROLES.PARENT) {
    const children = await accessService.linkedStudentIds(user);
    if (!app.enrolledStudentId || !children.includes(app.enrolledStudentId)) {
      throw new ApiError(403, "This document is not linked to your account.");
    }
  } else if (!hasPermission(user, "admissions.manage")) {
    throw new ApiError(403, "Access Denied. You don't have permission.");
  }
  const doc = await ApplicationDocuments.findOne({ where: { id: documentId, fkApplicationId: app.id } });
  if (!doc) throw new ApiError(404, "Document not found");
  if (!storageService.isObjectKey(doc.fileUrl)) throw new ApiError(404, "No file has been uploaded for this document.");
  return storageService.signedDownloadUrl(doc.fileUrl);
}

async function clearDocumentFile(id, schoolId, documentId) {
  return sequelize.transaction(async (t) => {
    const row = await lockApplication(id, schoolId, t);
    assertEditable(row);
    const doc = await ApplicationDocuments.findOne({
      where: { id: documentId, fkApplicationId: id },
      transaction: t,
    });
    if (!doc) throw new ApiError(404, "Document not found");
    const previousKey = doc.fileUrl;
    await doc.update({ status: "Pending", fileUrl: null }, { transaction: t });
    t.afterCommit(() => storageService.isObjectKey(previousKey) && storageService.deleteObject(previousKey));
    return getById(id, schoolId, { transaction: t });
  });
}

async function createDraft(schoolId, data = {}) {
  return sequelize.transaction(async (t) => {
    const columns = await columnsFrom(schoolId, data, t);
    let grade = "Unassigned";
    let fkClassId = null;
    if (columns.fkClassId) {
      fkClassId = columns.fkClassId;
      grade = columns.gradeApplyingFor || grade;
    }
    const nameParts = data.name
      ? String(data.name).trim().split(/\s+/)
      : ["Draft", "Application"];
    const app = await Applications.create(
      {
        applicantFirstName: nameParts[0] || "Draft",
        applicantLastName: nameParts.slice(1).join(" ") || "Application",
        gender: columns.gender || "Other",
        dateOfBirth: columns.dateOfBirth || "2010-01-01",
        gradeApplyingFor: grade,
        fkClassId,
        parentName: columns.parentName || "Pending",
        parentPhone: columns.parentPhone || "0000000000",
        parentEmail: columns.parentEmail || null,
        address: columns.address || null,
        previousSchool: columns.previousSchool || null,
        previousClass: columns.previousClass || null,
        guardianRelation: columns.guardianRelation || null,
        guardianAddress: columns.guardianAddress || null,
        interviewType: columns.interviewType || null,
        interviewDate: columns.interviewDate || null,
        interviewScore: columns.interviewScore || null,
        interviewResult: columns.interviewResult || null,
        notes: columns.notes || null,
        fkSchoolId: schoolId,
        fkSessionId: await currentSessionId(schoolId, t),
        status: APPLICATION_STATUS.NEW,
        submittedOn: null,
      },
      { transaction: t },
    );
    if (data.documents?.length) {
      await syncDocuments(app.id, data.documents, t);
    } else {
      await ensureDefaultDocuments(app.id, t);
    }
    return getById(app.id, schoolId, { transaction: t });
  });
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
      await syncDocuments(app.id, documents, t);
    } else {
      await ensureDefaultDocuments(app.id, t);
    }
    return getById(app.id, schoolId, { transaction: t });
  });
}

async function update(id, schoolId, data) {
  if (data.status !== undefined) {
    throw new ApiError(400, "Use dedicated endpoints to change application status");
  }
  return sequelize.transaction(async (t) => {
    const row = await lockApplication(id, schoolId, t);
    assertEditable(row);
    const { documents, ...rest } = data;
    const columns = await columnsFrom(schoolId, rest, t);
    await row.update(columns, { transaction: t });
    if (documents !== undefined) {
      await syncDocuments(id, documents, t);
    }
    return getById(id, schoolId, { transaction: t });
  });
}

async function submit(id, schoolId) {
  return sequelize.transaction(async (t) => {
    const row = await lockApplication(id, schoolId, t);
    assertEditable(row);
    if (row.submittedOn) {
      return getById(id, schoolId, { transaction: t });
    }
    validateForSubmit(row);
    await row.update(
      { submittedOn: new Date().toISOString().slice(0, 10) },
      { transaction: t },
    );
    return getById(id, schoolId, { transaction: t });
  });
}

async function markUnderReview(id, schoolId) {
  return sequelize.transaction(async (t) => {
    const row = await lockApplication(id, schoolId, t);
    assertSubmitted(row);
    if (row.status !== APPLICATION_STATUS.NEW) {
      throw new ApiError(400, "Only new applications can be marked under review");
    }
    await row.update({ status: APPLICATION_STATUS.REVIEW }, { transaction: t });
    return getById(id, schoolId, { transaction: t });
  });
}

async function decide(id, schoolId, decision, remarks) {
  if (!Object.values(APPLICATION_DECISION).includes(decision)) {
    throw new ApiError(400, "Invalid decision");
  }
  return sequelize.transaction(async (t) => {
    const row = await lockApplication(id, schoolId, t);
    assertSubmitted(row);
    if (row.status === APPLICATION_STATUS.ENROLLED) {
      throw new ApiError(400, "An enrolled application cannot be decided again");
    }
    let status = APPLICATION_STATUS.REVIEW;
    if (decision === APPLICATION_DECISION.REJECT) {
      status = APPLICATION_STATUS.REJECTED;
    }
    if (decision === APPLICATION_DECISION.WAITLIST) {
      status = APPLICATION_STATUS.WAITLIST;
    }
    const patch = { decision, status };
    if (remarks) {
      const existing = row.notes ? String(row.notes).trim() : "";
      patch.notes = existing ? `${existing}\n${remarks}` : remarks;
    }
    await row.update(patch, { transaction: t });
    return getById(id, schoolId, { transaction: t });
  });
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

/**
 * Link the guardian to the new student. With an email the guardian gets a
 * parent-portal account (and an invitation); without one we keep a guardian
 * record only, matched by phone so siblings share it.
 */
async function linkGuardian(schoolId, app, student, transaction) {
  const email = app.parentEmail && String(app.parentEmail).trim().toLowerCase();
  const relation = RELATIONS.has(app.guardianRelation) ? app.guardianRelation : "Guardian";
  const guardianName = String(app.parentName || "Guardian").trim();
  const nameFields = {
    guardianName,
    ...(relation === "Father" ? { fatherName: guardianName } : {}),
    ...(relation === "Mother" ? { motherName: guardianName } : {}),
  };
  let parent;
  let createdUser = null;
  if (!email) {
    parent = await Parents.findOne({
      where: { fkSchoolId: schoolId, fkUserId: null, primaryContactNumber: app.parentPhone, guardianName },
      transaction,
    });
    if (!parent) {
      parent = await Parents.create(
        { fkSchoolId: schoolId, fkUserId: null, primaryContactNumber: app.parentPhone, ...nameFields },
        { transaction },
      );
    }
  } else {
    let user = await Users.findOne({ where: { email, fkSchoolId: schoolId }, transaction });
    if (user) {
      if (user.role !== USER_ROLES.PARENT) {
        throw new ApiError(409, "Guardian email belongs to a staff account");
      }
      parent = await Parents.findOne({ where: { fkUserId: user.id, fkSchoolId: schoolId }, transaction });
      if (!parent) {
        parent = await Parents.create(
          { fkUserId: user.id, fkSchoolId: schoolId, primaryContactNumber: app.parentPhone, guardianName },
          { transaction },
        );
      }
    } else {
      const parts = guardianName.split(/\s+/);
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
        { fkUserId: user.id, fkSchoolId: schoolId, primaryContactNumber: app.parentPhone, ...nameFields },
        { transaction },
      );
      createdUser = user;
    }
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
  assertSubmitted(app);

  const createdParent = await sequelize.transaction(async (t) => {
    const klass = await Classes.findOne({
      where: { id: app.fkClassId, fkSchoolId: schoolId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!klass) throw new ApiError(404, "Class not found");
    if (klass.capacity != null) {
      const seated = await Students.count({
        where: { fkClassId: klass.id, fkSchoolId: schoolId, status: STUDENT_STATUS.ACTIVE },
        transaction: t,
      });
      if (seated >= Number(klass.capacity)) {
        throw new ApiError(409, "Class is at capacity");
      }
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
    await syncClassStatus(klass.id, t);
    const parentUser = await linkGuardian(schoolId, app, student, t);
    await feeService.openLedger(schoolId, student, t);
    await app.update(
      { status: APPLICATION_STATUS.ENROLLED, enrolledStudentId: student.id },
      { transaction: t },
    );
    if (actor) {
      await auditService.record(
        actor,
        `enrolled ${student.firstName} ${student.lastName} (${student.admissionNo})`,
        {
          entityType: "student",
          entityId: student.id,
          metadata: { applicationId: app.id, classId: klass.id },
        },
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

  return {
    application: await getById(id, schoolId),
    student: await Students.findByPk((await getById(id, schoolId)).enrolledStudentId),
  };
}

module.exports = {
  list,
  statusSummary,
  getById,
  createDraft,
  create,
  update,
  submit,
  markUnderReview,
  decide,
  enroll,
  documentDownloadUrl,
  clearDocumentFile,
};
