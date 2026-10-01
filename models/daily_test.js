"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** A dated weekly subject test; pass/fail is derived from school settings. */
module.exports = (sequelize, DataTypes) => {
  const DailyTest = sequelize.define(
    "daily_tests",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkScheduleId: ref(DataTypes, "fk_schedule_id", true),
      fkClassId: ref(DataTypes, "fk_class_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id", true),
      fkTeacherId: ref(DataTypes, "fk_teacher_id", true),
      date: { type: DataTypes.DATEONLY, allowNull: false },
      month: { type: DataTypes.STRING(7), allowNull: false },
      weekOfMonth: { type: DataTypes.INTEGER, allowNull: true, field: "week_of_month" },
      periodIndex: { type: DataTypes.INTEGER, allowNull: true, field: "period_index" },
      title: { type: DataTypes.STRING, allowNull: false },
      maxScore: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 20, field: "max_score" },
      status: {
        type: DataTypes.ENUM("Scheduled", "MarksEntered", "Published"),
        allowNull: false,
        defaultValue: "Scheduled",
      },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: "published_at" },
      fkPublishedByUserId: ref(DataTypes, "fk_published_by_user_id", true),
    },
    archivable("daily_tests"),
  );

  DailyTest.associate = (models) => {
    DailyTest.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    DailyTest.belongsTo(models.DailyTestSchedules, { foreignKey: "fkScheduleId", as: "schedule" });
    DailyTest.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    DailyTest.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    DailyTest.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
    DailyTest.hasMany(models.DailyTestResults, { foreignKey: "fkDailyTestId", as: "results" });
  };

  return DailyTest;
};
