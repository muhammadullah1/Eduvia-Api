"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherAbsence = sequelize.define("teacher_absences", {
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
    fkTeacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_teacher_id"
    },
    fkClassId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_class_id"
    },
    fkSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_subject_id"
    },
    fkTimetableSlotId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_timetable_slot_id"
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    periodIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "period_index"
    },
    status: {
      type: DataTypes.ENUM("Pending", "Covered", "Cancelled", "NoClass"),
      allowNull: false,
      defaultValue: "Pending",
    },
    fkMarkedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_marked_by_user_id"
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
  },
    {
      tableName: "teacher_absences",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  TeacherAbsence.associate = (models) => {
    TeacherAbsence.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school"
    });
    TeacherAbsence.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher"
    });
    TeacherAbsence.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class"
    });
    TeacherAbsence.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject"
    });
    TeacherAbsence.belongsTo(models.TimetableSlots, {
      foreignKey: "fkTimetableSlotId",
      as: "slot"
    });
    TeacherAbsence.belongsTo(models.Users, {
      foreignKey: "fkMarkedByUserId",
      as: "markedBy"
    });
    TeacherAbsence.hasOne(models.SubstituteAssignments, {
      foreignKey: "fkAbsenceId",
      as: "substitution"
    });
  };

  return TeacherAbsence;
};
