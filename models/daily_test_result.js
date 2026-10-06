"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTestResult = sequelize.define("daily_test_results",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      fkDailyTestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_daily_test_id",
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id"
      },
      score: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
      },
      fkEnteredByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_entered_by_user_id"
      },
    },
    {
      tableName: "daily_test_results",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  DailyTestResult.associate = (models) => {
    DailyTestResult.belongsTo(models.DailyTests, {
      foreignKey: "fkDailyTestId",
      as: "test"
    });
    DailyTestResult.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student"
    });
  };

  return DailyTestResult;
};
