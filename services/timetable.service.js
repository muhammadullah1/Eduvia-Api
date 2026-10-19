"use strict";

const { Op } = require("sequelize");
const {
  sequelize,
  TimetableSlots,
  Teachers,
  Users,
  Subjects,
  Classes,
} = require("../models");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const classSubjectService = require("./class_subject.service");

const SLOT_INCLUDE = [
  { model: Subjects, as: "subject", attributes: ["id", "name"] },
  {
    model: Classes,
    as: "class",
    attributes: ["id", "label", "grade", "section"],
  },
  {
    model: Teachers,
    as: "teacher",
    attributes: ["id"],
    include: [{ model: Users, as: "user", attributes: ["firstName", "lastName", "email"] }],
  },
];

function clock(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || "").trim());
  if (!match) throw new ApiError(400, "Start time must be HH:mm.");
  return `${match[1]}:${match[2]}`;
}

function storedClock(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  return String(value).slice(0, 5);
}

async function listByClass(user, classId) {
  const where = { fkSchoolId: user.schoolId };
  if (classId) {
    await accessService.assertClassVisible(user, classId);
    where.fkClassId = classId;
  }
  return TimetableSlots.findAll({
    where,
    include: SLOT_INCLUDE,
    order: [["day", "ASC"], ["periodIndex", "ASC"]],
  });
}

async function prepare(schoolId, data) {
  const klass = await Classes.findOne({
    where: { id: data.fkClassId, fkSchoolId: schoolId },
  });
  if (!klass) throw new ApiError(404, "Class not found");
  if (data.periodIndex > klass.periodCount) {
    throw new ApiError(400, `${klass.label} only has ${klass.periodCount} periods.`);
  }

  if (!data.fkTeacherId) throw new ApiError(400, "A teacher is required.");
  const resolved = {
    fkClassId: klass.id,
    classLabel: klass.label,
    periodIndex: data.periodIndex,
    startTime: clock(data.time ?? data.startTime),
    room: data.room ? String(data.room).trim() : null,
    fkTeacherId: data.fkTeacherId,
    fkSubjectId: data.fkSubjectId || null,
    teacher: null,
  };

  const teacher = await Teachers.findOne({
      where: { id: resolved.fkTeacherId, fkSchoolId: schoolId },
      include: [{ model: Users, as: "user", attributes: ["firstName", "lastName"] }],
    });
    if (!teacher) throw new ApiError(404, "Teacher not found");
    if (resolved.fkSubjectId && resolved.fkSubjectId !== teacher.fkSubjectId) {
      throw new ApiError(
        400,
        "This teacher is assigned a different subject. Change the teacher's subject first.",
      );
    }
    resolved.fkSubjectId = teacher.fkSubjectId;
    resolved.teacher = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();

  if (!resolved.fkSubjectId) throw new ApiError(400, "A subject is required.");
  const subject = await Subjects.findOne({
    where: { id: resolved.fkSubjectId, fkSchoolId: schoolId },
  });
  if (!subject) throw new ApiError(404, "Subject not found");
  resolved.subject = subject.name;
  return resolved;
}

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function orderedDays(days) {
  return DAY_ORDER.filter((day) => days.has(day));
}

function collectClashes(rows, resolved, days) {
  const classDays = new Set();
  const teacherGroups = new Map();

  for (const day of days) {
    for (const row of rows) {
      if (row.day !== day) continue;
      const samePeriod = Number(row.periodIndex) === Number(resolved.periodIndex);
      const sameTime = storedClock(row.startTime) === resolved.startTime;
      const sameClass = Number(row.fkClassId) === Number(resolved.fkClassId);
      if (sameClass && (samePeriod || sameTime)) {
        classDays.add(day);
        continue;
      }
      if (
        resolved.fkTeacherId &&
        Number(row.fkTeacherId) === Number(resolved.fkTeacherId) &&
        sameTime
      ) {
        const key = `${row.fkClassId}|${storedClock(row.startTime)}|${row.periodIndex}`;
        const group = teacherGroups.get(key) || {
          label: row.class?.label || "another class",
          time: storedClock(row.startTime) || resolved.startTime,
          period: row.periodIndex,
          days: new Set(),
        };
        group.days.add(day);
        teacherGroups.set(key, group);
      }
    }
  }

  const messages = [];
  if (classDays.size) {
    messages.push(
      `${resolved.classLabel} already has period ${resolved.periodIndex} at ${resolved.startTime} on ${orderedDays(classDays).join(", ")}.`,
    );
  }
  for (const group of teacherGroups.values()) {
    messages.push(
      `${resolved.teacher} already teaches ${group.label} at ${group.time} (period ${group.period}) on ${orderedDays(group.days).join(", ")}.`,
    );
  }
  return messages;
}

async function assertFree(schoolId, resolved, days, excludeId, transaction) {
  const rows = await TimetableSlots.findAll({
    where: {
      fkSchoolId: schoolId,
      day: { [Op.in]: days },
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const classIds = [...new Set(rows.map((row) => row.fkClassId))];
  const classes = classIds.length
    ? await Classes.findAll({
        where: { id: classIds },
        attributes: ["id", "label"],
        transaction,
      })
    : [];
  const labels = new Map(classes.map((row) => [row.id, row.label]));
  const decorated = rows.map((row) => ({
    day: row.day,
    periodIndex: row.periodIndex,
    startTime: row.startTime,
    fkClassId: row.fkClassId,
    fkTeacherId: row.fkTeacherId,
    class: { label: labels.get(row.fkClassId) },
  }));
  const messages = collectClashes(decorated, resolved, days);
  if (messages.length) {
    throw new ApiError(409, [...new Set(messages)].join(" "));
  }
}

function rowValues(schoolId, resolved, day) {
  return {
    fkSchoolId: schoolId,
    fkClassId: resolved.fkClassId,
    day,
    periodIndex: resolved.periodIndex,
    startTime: `${resolved.startTime}:00`,
    fkSubjectId: resolved.fkSubjectId,
    fkTeacherId: resolved.fkTeacherId,
    room: resolved.room,
  };
}

async function createMany(schoolId, data) {
  const days = data.days?.length ? data.days : [data.day];
  const resolved = await prepare(schoolId, data);
  return sequelize.transaction(async (transaction) => {
    await assertFree(schoolId, resolved, days, null, transaction);
    const created = [];
    for (const day of days) {
      created.push(await TimetableSlots.create(rowValues(schoolId, resolved, day), { transaction }));
    }
    await classSubjectService.ensureOffered(resolved.fkClassId, resolved.fkSubjectId, transaction);
    return created;
  });
}

async function create(schoolId, data) {
  const [row] = await createMany(schoolId, data);
  return row;
}

async function update(id, schoolId, data) {
  return sequelize.transaction(async (transaction) => {
    const row = await TimetableSlots.findOne({
      where: { id, fkSchoolId: schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new ApiError(404, "Timetable slot not found");
    const previousClassId = row.fkClassId;
    const previousSubjectId = row.fkSubjectId;
    const merged = {
      fkClassId: data.fkClassId ?? row.fkClassId,
      day: data.day ?? row.day,
      time: data.time ?? data.startTime ?? storedClock(row.startTime),
      periodIndex: data.periodIndex ?? row.periodIndex,
      fkTeacherId: data.fkTeacherId !== undefined ? data.fkTeacherId : row.fkTeacherId,
      fkSubjectId: data.fkSubjectId ?? row.fkSubjectId,
      room: data.room !== undefined ? data.room : row.room,
    };
    const resolved = await prepare(schoolId, merged);
    await assertFree(schoolId, resolved, [merged.day], row.id, transaction);
    await row.update(rowValues(schoolId, resolved, merged.day), { transaction });
    await classSubjectService.ensureOffered(resolved.fkClassId, resolved.fkSubjectId, transaction);
    if (previousClassId !== resolved.fkClassId || previousSubjectId !== resolved.fkSubjectId) {
      await classSubjectService.pruneIfUnscheduled(previousClassId, previousSubjectId, transaction);
    }
    return row;
  });
}

async function remove(id, schoolId) {
  const row = await TimetableSlots.findOne({ where: { id, fkSchoolId: schoolId } });
  if (!row) throw new ApiError(404, "Timetable slot not found");
  const classId = row.fkClassId;
  const subjectId = row.fkSubjectId;
  await row.destroy();
  await classSubjectService.pruneIfUnscheduled(classId, subjectId);
  return true;
}

function slotPayload(resolved) {
  return {
    fkClassId: resolved.fkClassId,
    day: resolved.day,
    periodIndex: resolved.periodIndex,
    startTime: resolved.startTime,
    fkSubjectId: resolved.fkSubjectId,
    fkTeacherId: resolved.fkTeacherId ?? null,
    room: resolved.room ?? null,
  };
}

module.exports = {
  listByClass,
  create,
  createMany,
  update,
  remove,
  slotPayload,
  collectClashes,
  storedClock,
};
