"use strict";

module.exports = (sequelize, DataTypes) => {
  const TimetableSlot = sequelize.define(
    "timetable_slots",
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
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_teacher_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      day: {
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
      periodIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "period_index",
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: "start_time",
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: "end_time",
      },
      room: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: "timetable_slots",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  TimetableSlot.associate = (models) => {
    TimetableSlot.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    TimetableSlot.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    TimetableSlot.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    TimetableSlot.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    TimetableSlot.hasMany(models.SubstituteAssignments, {
      foreignKey: "fkTimetableSlotId",
      as: "substituteAssignments",
    });
  };

  return TimetableSlot;
};
