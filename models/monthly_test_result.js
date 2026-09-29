"use strict";

module.exports = (sequelize, DataTypes) => {
  const MonthlyTestResult = sequelize.define(
    "monthly_test_results",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkMonthlyTestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_monthly_test_id",
      },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      score: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      passed: { type: DataTypes.BOOLEAN, allowNull: true },
    },
    {
      tableName: "monthly_test_results",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  MonthlyTestResult.associate = (models) => {
    MonthlyTestResult.belongsTo(models.MonthlyTests, {
      foreignKey: "fkMonthlyTestId",
      as: "test",
    });
    MonthlyTestResult.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
  };

  return MonthlyTestResult;
};
