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
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Pending",
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
  };

  return TeacherAbsence;
};
