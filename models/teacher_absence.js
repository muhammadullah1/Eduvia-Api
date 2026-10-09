"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherAbsence = sequelize.define(
    "teacher_absences",
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
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_teacher_id",
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
      fkTimetableSlotId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_timetable_slot_id",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("Pending", "Covered", "Cancelled", "NoClass"),
        allowNull: false,
        defaultValue: "Pending",
      },
      fkMarkedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_marked_by_user_id",
      },
      fkApprovedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_approved_by_user_id",
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
      getterMethods: {
        notes() {
          return this.getDataValue("reason");
        },
      },
      setterMethods: {
        notes(val) {
          this.setDataValue("reason", val);
        },
      },
    }
  );

  TeacherAbsence.associate = (models) => {
    TeacherAbsence.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    TeacherAbsence.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    TeacherAbsence.belongsTo(models.Users, {
      foreignKey: "fkApprovedByUserId",
      as: "approvedBy",
    });
    TeacherAbsence.hasMany(models.SubstituteAssignments, {
      foreignKey: "fkAbsenceId",
      as: "substitutions",
    });
    TeacherAbsence.hasOne(models.SubstituteAssignments, {
      foreignKey: "fkAbsenceId",
      as: "substitution",
    });
  };

  return TeacherAbsence;
};
