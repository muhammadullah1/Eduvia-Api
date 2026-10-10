"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTest = sequelize.define(
    "daily_tests",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_teacher_id",
      },
      fkScheduleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_schedule_id",
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      month: {
        type: DataTypes.STRING(7),
        allowNull: false,
      },
      weekOfMonth: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "week_of_month",
      },
      status: {
        type: DataTypes.ENUM("Scheduled", "MarksEntered", "Published"),
        allowNull: false,
        defaultValue: "Scheduled",
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "published_at",
      },
      fkPublishedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_published_by_user_id",
      },
      totalMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 20.0,
        field: "total_marks",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      getterMethods: {
        maxScore() {
          return this.getDataValue("totalMarks");
        },
      },
      setterMethods: {
        maxScore(val) {
          this.setDataValue("totalMarks", val);
        },
      },
    }
  );

  DailyTest.associate = (models) => {
    DailyTest.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    DailyTest.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    DailyTest.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    DailyTest.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    DailyTest.hasMany(models.DailyTestResults, {
      foreignKey: "fkDailyTestId",
      as: "results",
    });
  };

  return DailyTest;
};
