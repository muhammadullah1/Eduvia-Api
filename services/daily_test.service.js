"use strict";

const {
  DailyTests,
  DailyTestResults,
  Classes,
  Subjects,
  sequelize,
} = require("../models");
const ApiError = require("../utils/ApiError");

async function list(schoolId, { classId, date } = {}) {
  const where = { fkSchoolId: schoolId };
  if (classId) where.fkClassId = classId;
  if (date) where.date = date;
  return DailyTests.findAll({
    where,
    include: [
      { model: DailyTestResults, as: "results" },
      { model: Classes, as: "class" },
      { model: Subjects, as: "subject" },
    ],
    order: [["date", "DESC"], ["id", "DESC"]],
  });
}

async function getById(id, schoolId) {
  const row = await DailyTests.findOne({
    where: { id, fkSchoolId: schoolId },
    include: [{ model: DailyTestResults, as: "results" }],
  });
  if (!row) throw new ApiError(404, "Daily test not found");
  return row;
}

async function create(schoolId, data) {
  const { results = [], ...rest } = data;
  return sequelize.transaction(async (t) => {
    const test = await DailyTests.create(
      { ...rest, fkSchoolId: schoolId },
      { transaction: t },
    );
    if (results.length) {
      await DailyTestResults.bulkCreate(
        results.map((r) => ({
          fkDailyTestId: test.id,
          fkStudentId: r.studentId || r.fkStudentId,
          score: r.score ?? null,
        })),
        { transaction: t },
      );
    }
    return getById(test.id, schoolId);
  });
}

async function updateResults(id, schoolId, results) {
  await getById(id, schoolId);
  return sequelize.transaction(async (t) => {
    for (const r of results) {
      const studentId = r.studentId || r.fkStudentId;
      const [row] = await DailyTestResults.findOrCreate({
        where: { fkDailyTestId: id, fkStudentId: studentId },
        defaults: { score: r.score ?? null },
        transaction: t,
      });
      await row.update({ score: r.score ?? null }, { transaction: t });
    }
    return getById(id, schoolId);
  });
}

module.exports = { list, getById, create, updateResults };
