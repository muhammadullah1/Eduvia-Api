"use strict";

module.exports = (sequelize, DataTypes) => {
  const MonthlyStudentSummary = sequelize.define("monthly_student_summaries", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    fkSchoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_school_id"
    },
    fkClassId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_class_id"
    },
    fkSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_subject_id"
    },
    fkStudentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_student_id"
    },
    month: {
      type: DataTypes.STRING,
      allowNull: false
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
    averagePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      field: "average_percent",
    },
    flaggedForFollowUp: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "flagged_for_follow_up",
    },
    status: {
      type: DataTypes.ENUM("InProgress", "Passed", "LowMarks", "Failed"),
      allowNull: false,
      defaultValue: "InProgress",
    },
  },
    {
      tableName: "monthly_student_summaries",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  MonthlyStudentSummary.associate = (models) => {
    MonthlyStudentSummary.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school"
    });
    MonthlyStudentSummary.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class"
    });
    MonthlyStudentSummary.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    MonthlyStudentSummary.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
  };

  return MonthlyStudentSummary;
};
