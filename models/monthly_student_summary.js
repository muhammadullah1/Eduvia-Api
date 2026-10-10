"use strict";

module.exports = (sequelize, DataTypes) => {
  const MonthlyStudentSummary = sequelize.define(
    "monthly_student_summaries",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_class_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_subject_id",
      },
      month: {
        type: DataTypes.STRING(7),
        allowNull: false,
      },
      testsScheduled: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "tests_scheduled",
      },
      testsTaken: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "tests_taken",
      },
      passedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "passed_count",
      },
      failedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "failed_count",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      flaggedForFollowUp: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "flagged_for_follow_up",
      },
      attendancePercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "attendance_percentage",
      },
      dailyTestPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "daily_test_percentage",
      },
      feeStatus: {
        type: DataTypes.ENUM("Paid", "Partial", "Unpaid"),
        allowNull: true,
        field: "fee_status",
      },
      teacherRemarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "teacher_remarks",
      },
    },
    {
      tableName: "monthly_student_summaries",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        averagePercent() {
          return this.getDataValue("dailyTestPercentage");
        },
      },
      setterMethods: {
        averagePercent(val) {
          this.setDataValue("dailyTestPercentage", val);
        },
      },
    }
  );

  MonthlyStudentSummary.associate = (models) => {
    MonthlyStudentSummary.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    MonthlyStudentSummary.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
  };

  return MonthlyStudentSummary;
};
