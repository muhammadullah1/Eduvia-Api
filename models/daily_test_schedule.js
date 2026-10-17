"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTestSchedule = sequelize.define(
    "daily_test_schedules",
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
      dayOfWeek: {
        type: DataTypes.ENUM(
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday"
        ),
        allowNull: false,
        field: "day_of_week",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      totalMarks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
        field: "total_marks",
      },
    },
    {
      tableName: "daily_test_schedules",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        weekday() {
          return this.getDataValue("dayOfWeek");
        },
        maxScore() {
          return this.getDataValue("totalMarks");
        },
      },
      setterMethods: {
        weekday(val) {
          this.setDataValue("dayOfWeek", val);
        },
        maxScore(val) {
          this.setDataValue("totalMarks", val);
        },
      },
    }
  );

  DailyTestSchedule.associate = (models) => {
    DailyTestSchedule.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    DailyTestSchedule.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    DailyTestSchedule.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
  };

  return DailyTestSchedule;
};
