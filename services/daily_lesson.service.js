"use strict";

const { Op } = require("sequelize");
const { DailyLessons, PlannedChapters, Classes, Subjects, Teachers, Users } = require("../models");
const { USER_ROLES, LESSON_REVIEW_STATUS } = require("../constants");
const ApiError = require("../utils/ApiError");
const accessService = require("./access.service");
const auditService = require("./audit.service");

/**
 * Daily teaching updates (UR-04 / BR-05): the teacher selects a planned
 * chapter, management reviews, and only approved updates reach parents.
 */

const include = [
  { model: Classes, as: "class", attributes: ["id", "label"] },
  { model: Subjects, as: "subject", attributes: ["id", "name"] },
  { model: PlannedChapters, as: "chapter", attributes: ["id", "chapterNo", "title"] },
  { model: Teachers, as: "teacher", attributes: ["id"], include: [{ model: Users, as: "user", attributes: ["firstName", "lastName", "email"] }] },
];

async function list(user, { classId, subjectId, date, from, to, reviewStatus, studentId } = {}) {
  const where = { fkSchoolId: user.schoolId };
  if (classId) where.fkClassId = classId;
  if (subjectId) where.fkSubjectId = subjectId;
  if (date) where.date = date;
  if (from || to) where.date = { ...(from && { [Op.gte]: from }), ...(to && { [Op.lte]: to }) };
  if (reviewStatus) where.reviewStatus = reviewStatus;

  if (user.role === USER_ROLES.PARENT) {
    const classIds = studentId
      ? [(await accessService.assertStudentAccess(user, studentId)).fkClassId]
      : await accessService.linkedClassIds(user);
    where.fkClassId = classId ? classIds.filter((id) => id === Number(classId)) : classIds;
  } else if (user.role === USER_ROLES.TEACHER) {
    where.fkTeacherId = (await accessService.teacherFor(user)).id;
  }
  return DailyLessons.findAll({
    where,
    include,
    order: [["date", "DESC"], ["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await DailyLessons.findOne({ where: { id, fkSchoolId: schoolId }, include });
  if (!row) throw new ApiError(404, "Daily update not found");
  return row;
}

async function chapterFor(schoolId, plannedChapterId, classId) {
  const chapter = await PlannedChapters.findOne({ where: { id: plannedChapterId, fkSchoolId: schoolId } });
  if (!chapter) throw new ApiError(404, "Planned chapter not found");
  if (classId && chapter.fkClassId !== Number(classId)) throw new ApiError(400, "Chapter belongs to a different class.");
  return chapter;
}

async function create(user, data) {
  const chapter = await chapterFor(user.schoolId, data.plannedChapterId, data.classId);
  const teacher = await accessService.assertTeacherCanTeach(user, {
    classId: chapter.fkClassId,
    subjectId: chapter.fkSubjectId,
    date: data.date,
  });
  return DailyLessons.create({
    fkSchoolId: user.schoolId,
    fkClassId: chapter.fkClassId,
    fkSubjectId: chapter.fkSubjectId,
    fkTeacherId: teacher.id,
    fkPlannedChapterId: chapter.id,
    chapter: chapter.title,
    title: data.title || null,
    date: data.date,
    periodIndex: data.periodIndex || null,
    classwork: data.classwork || null,
    homework: data.homework || null,
    remarks: data.remarks || null,
    progress: data.progress ?? 0,
    status: data.status || "In progress",
    reviewStatus: LESSON_REVIEW_STATUS.SUBMITTED,
    fkSubmittedByUserId: user.id,
  });
}

async function update(user, id, data) {
  const row = await getById(id, user.schoolId);
  const teacher = await accessService.teacherFor(user);
  if (row.fkTeacherId !== teacher.id) throw new ApiError(403, "You can only edit your own updates.");
  if (row.reviewStatus === LESSON_REVIEW_STATUS.APPROVED) throw new ApiError(400, "Approved updates are locked.");
  const changes = { ...data, reviewStatus: LESSON_REVIEW_STATUS.SUBMITTED, reviewNote: null };
  if (data.plannedChapterId) {
    const chapter = await chapterFor(user.schoolId, data.plannedChapterId, row.fkClassId);
    if (chapter.fkSubjectId !== row.fkSubjectId) throw new ApiError(400, "Chapter belongs to a different subject.");
    Object.assign(changes, { fkPlannedChapterId: chapter.id, chapter: chapter.title });
  }
  delete changes.plannedChapterId;
  await row.update(changes);
  return getById(id, user.schoolId);
}

async function review(actor, id, { decision, note }) {
  const row = await getById(id, actor.schoolId);
  await row.update({ reviewStatus: decision, reviewNote: note || null, fkReviewedByUserId: actor.id, reviewedAt: new Date() });
  await auditService.record(actor, `${decision.toLowerCase()} daily update #${row.id}`, {
    entityType: "daily_lesson",
    entityId: row.id,
    metadata: { decision, note },
  });
  return getById(id, actor.schoolId);
}

async function remove(actor, id) {
  const row = await getById(id, actor.schoolId);
  await row.destroy();
  return true;
}

module.exports = { list, getById, create, update, review, remove };
