"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherSubject = sequelize.define(
    "teacher_subjects",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkTeacherId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_teacher_id" },
      fkSubjectId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_subject_id" },
    },
    {
      tableName: "teacher_subjects",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  return TeacherSubject;
};
