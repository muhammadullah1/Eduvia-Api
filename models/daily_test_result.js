"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTestResult = sequelize.define(
    "daily_test_results",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkDailyTestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_daily_test_id",
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
      },
      obtainedMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "obtained_marks",
      },
      isAbsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_absent",
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "daily_test_results",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        score() {
          return this.getDataValue("obtainedMarks");
        },
      },
      setterMethods: {
        score(val) {
          this.setDataValue("obtainedMarks", val);
        },
      },
    }
  );

  DailyTestResult.associate = (models) => {
    DailyTestResult.belongsTo(models.DailyTests, {
      foreignKey: "fkDailyTestId",
      as: "test",
    });
    DailyTestResult.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
  };

  return DailyTestResult;
};
