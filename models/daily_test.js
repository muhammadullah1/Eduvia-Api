"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTest = sequelize.define(
    "daily_tests",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_subject_id" },
      fkTeacherId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_teacher_id" },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      periodIndex: { type: DataTypes.INTEGER, allowNull: true, field: "period_index" },
      title: { type: DataTypes.STRING, allowNull: false },
      maxScore: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 20,
        field: "max_score",
      },
    },
    {
      tableName: "daily_tests",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  DailyTest.associate = (models) => {
    DailyTest.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    DailyTest.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    DailyTest.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    DailyTest.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
    DailyTest.hasMany(models.DailyTestResults, { foreignKey: "fkDailyTestId", as: "results" });
  };

  return DailyTest;
};
