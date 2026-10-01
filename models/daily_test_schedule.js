"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** One weekly test day per class + subject (UR-05 / BR-06). */
module.exports = (sequelize, DataTypes) => {
  const DailyTestSchedule = sequelize.define(
    "daily_test_schedules",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkClassId: ref(DataTypes, "fk_class_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id"),
      weekday: { type: DataTypes.STRING(12), allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: true, field: "period_index" },
      maxScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20, field: "max_score" },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
      fkCreatedByUserId: ref(DataTypes, "fk_created_by_user_id", true),
    },
    archivable("daily_test_schedules"),
  );

  DailyTestSchedule.associate = (models) => {
    DailyTestSchedule.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    DailyTestSchedule.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    DailyTestSchedule.hasMany(models.DailyTests, { foreignKey: "fkScheduleId", as: "tests" });
  };

  return DailyTestSchedule;
};
