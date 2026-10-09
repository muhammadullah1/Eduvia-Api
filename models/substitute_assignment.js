"use strict";

module.exports = (sequelize, DataTypes) => {
  const SubstituteAssignment = sequelize.define(
    "substitute_assignments",
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
      fkAbsenceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_absence_id",
      },
      fkTimetableSlotId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_timetable_slot_id",
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
      fkOriginalTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_original_teacher_id",
      },
      fkSubstituteTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_substitute_teacher_id",
      },
      fkAuthorizedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_authorized_by_user_id",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      periodIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "period_index",
      },
      status: {
        type: DataTypes.ENUM("Assigned", "Completed", "Cancelled"),
        allowNull: false,
        defaultValue: "Assigned",
      },
    },
    {
      tableName: "substitute_assignments",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  SubstituteAssignment.associate = (models) => {
    SubstituteAssignment.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    SubstituteAssignment.belongsTo(models.TeacherAbsences, {
      foreignKey: "fkAbsenceId",
      as: "absence",
    });
    SubstituteAssignment.belongsTo(models.TimetableSlots, {
      foreignKey: "fkTimetableSlotId",
      as: "slot",
    });
    SubstituteAssignment.belongsTo(models.Teachers, {
      foreignKey: "fkSubstituteTeacherId",
      as: "substituteTeacher",
    });
    SubstituteAssignment.belongsTo(models.Teachers, {
      foreignKey: "fkOriginalTeacherId",
      as: "originalTeacher",
    });
    SubstituteAssignment.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    SubstituteAssignment.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
  };

  return SubstituteAssignment;
};
