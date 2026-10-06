"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTest = sequelize.define("daily_tests", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    fkSchoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_school_id"
    },
    fkScheduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_schedule_id"
    },
    fkClassId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_class_id"
    },
    fkSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_subject_id"
    },
    fkTeacherId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_teacher_id"
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    month: {
      type: DataTypes.STRING(7),
      allowNull: false
    },
    weekOfMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "week_of_month"
    },
    periodIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "period_index"
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    maxScore: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 20,
      field: "max_score"
    },
    status: {
      type: DataTypes.ENUM("Scheduled", "MarksEntered", "Published"),
      allowNull: false,
      defaultValue: "Scheduled",
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "published_at"
    },
    fkPublishedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_published_by_user_id"
    },
  },
    {
      tableName: "daily_tests",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true

    }
  );

  DailyTest.associate = (models) => {
    DailyTest.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId", as: "school"
    });
    DailyTest.belongsTo(models.DailyTestSchedules, {
      foreignKey: "fkScheduleId", as: "schedule"
    });
    DailyTest.belongsTo(models.Classes, {
      foreignKey: "fkClassId", as: "class"
    });
    DailyTest.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId", as: "subject"
    });
    DailyTest.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId", as: "teacher"
    });
    DailyTest.hasMany(models.DailyTestResults, {
      foreignKey: "fkDailyTestId", as: "results"
    });
  };

  return DailyTest;
};
