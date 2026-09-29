"use strict";

const {
  MonthlyTests,
  MonthlyTestResults,
  MonthlyStudentSummaries,
  Classes,
  Subjects,
  sequelize,
  Sequelize,
} = require("../models");
const { Op } = Sequelize;
const { MONTHLY_TEST_RULES } = require("../constants");
const ApiError = require("../utils/ApiError");
const { computeMonthlyStatus, isPassedScore } = require("../utils/monthly_status");

async function list(schoolId, { classId, month, subjectId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (month) where.month = month;
  if (subjectId) where.fkSubjectId = subjectId;
  return MonthlyTests.findAll({
    where,
    include: [
      { model: MonthlyTestResults, as: "results" },
      { model: Classes, as: "class" },
      { model: Subjects, as: "subject" },
    ],
    order: [["month", "DESC"], ["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await MonthlyTests.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: MonthlyTestResults, as: "results" }],
  });
  if (!row) throw new ApiError(404, "Monthly test not found");
  return row;
}

async function create(schoolId, data) {
  const { results = [], ...rest } = data;
  return sequelize.transaction(async (t) => {
    const test = await MonthlyTests.create(
      {
        ...rest,
        fkSchoolId: schoolId,
        passPercent: rest.passPercent ?? MONTHLY_TEST_RULES.PASS_PERCENT,
      },
      { transaction: t },
    );
    if (results.length) {
      const rows = results.map((r) => {
        const score = r.score ?? null;
        return {
          fkMonthlyTestId: test.id,
          fkStudentId: r.studentId || r.fkStudentId,
          score,
          passed: isPassedScore(score, test.maxScore, test.passPercent),
        };
      });
      await MonthlyTestResults.bulkCreate(rows, { transaction: t });
    }
    await refreshSummaries(schoolId, test.fkClassId, test.fkSubjectId, test.month, t);
    return getById(test.id, schoolId);
  });
}

async function updateResults(id, schoolId, results) {
  const test = await getById(id, schoolId);
  return sequelize.transaction(async (t) => {
    for (const r of results) {
      const studentId = r.studentId || r.fkStudentId;
      const score = r.score ?? null;
      const passed = isPassedScore(score, test.maxScore, test.passPercent);
      const [row] = await MonthlyTestResults.findOrCreate({
        where: { fkMonthlyTestId: id, fkStudentId: studentId },
        defaults: { score, passed },
        transaction: t,
      });
      await row.update({ score, passed }, { transaction: t });
    }
    await refreshSummaries(schoolId, test.fkClassId, test.fkSubjectId, test.month, t);
    return getById(id, schoolId);
  });
}

async function refreshSummaries(schoolId, classId, subjectId, month, transaction) {
  const where = {
    fkSchoolId: schoolId,
    fkClassId: classId,
    month,
  };
  if (subjectId == null) where.fkSubjectId = { [Op.is]: null };
  else where.fkSubjectId = subjectId;

  const tests = await MonthlyTests.findAll({
    where,
    include: [{ model: MonthlyTestResults, as: "results" }],
    transaction,
  });

  const byStudent = new Map();
  for (const test of tests) {
    const max = Number(test.maxScore) || 100;
    for (const result of test.results) {
      if (result.score == null) continue;
      const key = result.fkStudentId;
      if (!byStudent.has(key)) {
        byStudent.set(key, { percents: [], passed: 0, failed: 0 });
      }
      const bucket = byStudent.get(key);
      const pct = (Number(result.score) / max) * 100;
      bucket.percents.push(pct);
      if (result.passed) bucket.passed += 1;
      else bucket.failed += 1;
    }
  }

  for (const [studentId, bucket] of byStudent.entries()) {
    const testsTaken = bucket.percents.length;
    const averagePercent =
      testsTaken === 0
        ? null
        : bucket.percents.reduce((a, b) => a + b, 0) / testsTaken;
    const status = computeMonthlyStatus({
      passedCount: bucket.passed,
      failedCount: bucket.failed,
      testsTaken,
      averagePercent,
    });

    const [summary] = await MonthlyStudentSummaries.findOrCreate({
      where: {
        fkStudentId: studentId,
        fkClassId: classId,
        fkSubjectId: subjectId ?? null,
        month,
      },
      defaults: {
        fkSchoolId: schoolId,
        testsTaken,
        passedCount: bucket.passed,
        failedCount: bucket.failed,
        averagePercent,
        status,
      },
      transaction,
    });
    await summary.update(
      {
        testsTaken,
        passedCount: bucket.passed,
        failedCount: bucket.failed,
        averagePercent,
        status,
      },
      { transaction },
    );
  }
}

async function listSummaries(schoolId, { classId, month, subjectId } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (month) where.month = month;
  if (subjectId) where.fkSubjectId = subjectId;
  return MonthlyStudentSummaries.findAll({
    where,
    order: [["status", "ASC"], ["fkStudentId", "ASC"]],
  });
}

module.exports = {
  list,
  getById,
  create,
  updateResults,
  listSummaries,
  refreshSummaries,
};
