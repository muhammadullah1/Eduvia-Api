"use strict";

const { Op } = require("sequelize");
const { Locations, AcademicSessions } = require("../models");
const ApiError = require("../utils/ApiError");

const LOCATION_TYPES = [
  "classroom",
  "lab",
  "auditorium",
  "gym",
  "sports_field",
  "library",
  "cafeteria",
  "music_room",
  "art_room",
  "playground",
  "online",
  "other",
];

async function sessionFor(schoolId, sessionId) {
  const where = { id: sessionId, fkSchoolId: schoolId };
  const session = await AcademicSessions.findOne({ where });
  if (!session) throw new ApiError(404, "Academic session not found");
  return session;
}

function normalize(payload, partial = false) {
  const out = {};
  if (!partial || payload.name !== undefined) {
    out.name = String(payload.name || "").trim();
  }
  if (payload.locationCode !== undefined || payload.location_code !== undefined) {
    const code = payload.locationCode ?? payload.location_code;
    out.locationCode = code ? String(code).trim() : null;
  }
  if (payload.locationType !== undefined || payload.location_type !== undefined) {
    const type = payload.locationType ?? payload.location_type;
    if (type && !LOCATION_TYPES.includes(type)) {
      throw new ApiError(400, "Unknown location type.");
    }
    out.locationType = type || null;
  }
  if (payload.description !== undefined) {
    out.description = payload.description ? String(payload.description).trim() : null;
  }
  if (!partial || payload.capacity !== undefined) {
    const capacity = Number(payload.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new ApiError(400, "Capacity must be at least 1.");
    }
    out.capacity = capacity;
  }
  return out;
}

async function assertUnique(schoolId, sessionId, name, locationCode, excludeId) {
  const nameWhere = {
    fkSchoolId: schoolId,
    fkSessionId: sessionId,
    name: { [Op.iLike]: name },
  };
  if (excludeId) nameWhere.id = { [Op.ne]: excludeId };
  const named = await Locations.findOne({ where: nameWhere });
  if (named) {
    throw new ApiError(409, "An active location with this name already exists in this session.");
  }
  if (!locationCode) return;
  const codeWhere = {
    fkSchoolId: schoolId,
    fkSessionId: sessionId,
    locationCode: { [Op.iLike]: locationCode },
  };
  if (excludeId) codeWhere.id = { [Op.ne]: excludeId };
  const coded = await Locations.findOne({ where: codeWhere });
  if (coded) {
    throw new ApiError(409, "An active location with this code already exists in this session.");
  }
}

async function assertNotArchived(schoolId, sessionId, name) {
  const archived = await Locations.findOne({
    where: {
      fkSchoolId: schoolId,
      fkSessionId: sessionId,
      name: { [Op.iLike]: name },
    },
    paranoid: false,
  });
  if (archived && archived.deletedAt) {
    throw new ApiError(
      409,
      `A location named "${name}" is already in the archive for this session. Restore it from Settings → Archives instead of creating a new one.`,
    );
  }
}

async function list(schoolId, { search, archived, sessionId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (sessionId) where.fkSessionId = sessionId;
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { locationCode: { [Op.iLike]: q } },
    ];
  }
  if (archived) where.archived_at = { [Op.ne]: null };
  return Locations.findAll({
    where,
    paranoid: !archived,
    order: [["name", "ASC"]],
  });
}

async function create(schoolId, payload) {
  const sessionId = Number(payload.fkSessionId ?? payload.sessionId);
  await sessionFor(schoolId, sessionId);
  const values = normalize(payload);
  if (!values.name) throw new ApiError(400, "Location name is required.");
  await assertNotArchived(schoolId, sessionId, values.name);
  await assertUnique(schoolId, sessionId, values.name, values.locationCode);
  return Locations.create({ ...values, fkSchoolId: schoolId, fkSessionId: sessionId });
}

async function update(id, schoolId, payload) {
  const row = await Locations.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Location not found");
  const values = normalize(payload, true);
  const name = values.name ?? row.name;
  const code = values.locationCode !== undefined ? values.locationCode : row.locationCode;
  if (values.name || values.locationCode !== undefined) {
    await assertUnique(schoolId, row.fkSessionId, name, code, row.id);
  }
  await row.update(values);
  return row;
}

async function remove(id, schoolId) {
  const row = await Locations.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Location not found");
  await row.destroy();
  return true;
}

async function restore(id, schoolId) {
  const row = await Locations.findOne({
    where: { id, fkSchoolId: schoolId },
    paranoid: false,
  });
  if (!row || !row.deletedAt) throw new ApiError(404, "Archived location not found");
  await assertUnique(schoolId, row.fkSessionId, row.name, row.locationCode, row.id);
  await row.restore();
  return row;
}

module.exports = { list, create, update, remove, restore, LOCATION_TYPES };
