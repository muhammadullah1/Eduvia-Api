"use strict";

const crypto = require("crypto");
const { SchoolSettings, Users } = require("../models");
const { USER_ROLES } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");

const SETTING_KEY = "school_updates";

async function getStoredUpdates(schoolId) {
  if (!schoolId) return [];
  const row = await SchoolSettings.findOne({ where: { fkSchoolId: schoolId, key: SETTING_KEY } });
  return row && Array.isArray(row.value) ? row.value : [];
}

async function saveStoredUpdates(schoolId, updates, userId) {
  const [row] = await SchoolSettings.findOrCreate({
    where: { fkSchoolId: schoolId, key: SETTING_KEY },
    defaults: { value: updates, fkUpdatedByUserId: userId },
  });
  await row.update({ value: updates, fkUpdatedByUserId: userId });
}

async function list(user, { classId, status, kind } = {}) {
  const all = await getStoredUpdates(user.schoolId);
  let filtered = all;

  if (user.role === USER_ROLES.PARENT) {
    const parentClassIds = await accessService.linkedClassIds(user);
    filtered = filtered.filter((u) => u.status === "Published" && parentClassIds.includes(Number(u.classId)));
  } else if (user.role === USER_ROLES.TEACHER) {
    filtered = filtered.filter((u) => u.status === "Published" || u.authorUserId === user.id || u.status === "Approved");
  }

  if (classId) {
    filtered = filtered.filter((u) => Number(u.classId) === Number(classId));
  }
  if (status) {
    filtered = filtered.filter((u) => u.status === status);
  }
  if (kind) {
    filtered = filtered.filter((u) => u.kind === kind);
  }

  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function create(actor, data) {
  const updates = await getStoredUpdates(actor.schoolId);
  const user = await Users.findByPk(actor.id);
  const authorName = user ? `${user.firstName} ${user.lastName}` : data.author || "Staff";

  const newUpdate = {
    id: `up-${crypto.randomBytes(4).toString("hex")}`,
    classId: Number(data.classId),
    kind: data.kind,
    subject: data.subject,
    text: data.text,
    status: "Draft",
    due: data.due || "",
    author: authorName,
    authorUserId: actor.id,
    createdAt: new Date().toISOString(),
  };

  updates.unshift(newUpdate);
  await saveStoredUpdates(actor.schoolId, updates, actor.id);
  await auditService.record(actor, `drafted class notice for class #${data.classId}`, {
    entityType: "school_update",
    entityId: null,
    metadata: { updateId: newUpdate.id, subject: data.subject, kind: data.kind },
  });

  return newUpdate;
}

async function setStatus(actor, id, status) {
  const updates = await getStoredUpdates(actor.schoolId);
  const item = updates.find((u) => u.id === id);
  if (!item) throw new ApiError(404, "Update not found");

  item.status = status;
  item.updatedAt = new Date().toISOString();
  await saveStoredUpdates(actor.schoolId, updates, actor.id);
  await auditService.record(actor, `${status.toLowerCase()} class notice "${item.subject}"`, {
    entityType: "school_update",
    entityId: null,
    metadata: { updateId: id, status, subject: item.subject },
  });

  return item;
}

async function remove(actor, id) {
  const updates = await getStoredUpdates(actor.schoolId);
  const idx = updates.findIndex((u) => u.id === id);
  if (idx === -1) throw new ApiError(404, "Update not found");

  updates.splice(idx, 1);
  await saveStoredUpdates(actor.schoolId, updates, actor.id);
  return true;
}

module.exports = { list, create, setStatus, remove };
