"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherSubjectAssignment = sequelize.define("teacher_subject_assignments", {
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
    fkSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_subject_id"
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "effective_from"
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "effective_to"
    },
    fkAssignedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_assigned_by_user_id"
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
  },
    {
      tableName: "teacher_subject_assignments",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  TeacherSubjectAssignment.associate = (models) => {
    TeacherSubjectAssignment.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher"
    });
    TeacherSubjectAssignment.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject"
    });
    TeacherSubjectAssignment.belongsTo(models.Users, {
      foreignKey: "fkAssignedByUserId",
      as: "assignedBy"
    });
  };

  return TeacherSubjectAssignment;
};
