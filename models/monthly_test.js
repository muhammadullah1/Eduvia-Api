"use strict";

module.exports = (sequelize, DataTypes) => {
  const MonthlyTest = sequelize.define(
    "monthly_tests",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_session_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_subject_id" },
      month: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      maxScore: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 100,
        field: "max_score",
      },
      passPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 40,
        field: "pass_percent",
      },
      testDate: { type: DataTypes.DATEONLY, allowNull: true, field: "test_date" },
    },
    {
      tableName: "monthly_tests",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  MonthlyTest.associate = (models) => {
    MonthlyTest.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    MonthlyTest.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
    MonthlyTest.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    MonthlyTest.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    MonthlyTest.hasMany(models.MonthlyTestResults, {
      foreignKey: "fkMonthlyTestId",
      as: "results",
    });
  };

  return MonthlyTest;
};
