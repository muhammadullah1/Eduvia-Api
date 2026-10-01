"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** History of a teacher's subject (UR-02 / BR-13). effectiveTo NULL = active. */
module.exports = (sequelize, DataTypes) => {
  const TeacherSubjectAssignment = sequelize.define(
    "teacher_subject_assignments",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkTeacherId: ref(DataTypes, "fk_teacher_id"),
      fkSubjectId: ref(DataTypes, "fk_subject_id"),
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false, field: "effective_from" },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true, field: "effective_to" },
      fkAssignedByUserId: ref(DataTypes, "fk_assigned_by_user_id", true),
      reason: { type: DataTypes.TEXT, allowNull: true },
    },
    archivable("teacher_subject_assignments"),
  );

  TeacherSubjectAssignment.associate = (models) => {
    TeacherSubjectAssignment.belongsTo(models.Teachers, { foreignKey: "fkTeacherId", as: "teacher" });
    TeacherSubjectAssignment.belongsTo(models.Subjects, { foreignKey: "fkSubjectId", as: "subject" });
    TeacherSubjectAssignment.belongsTo(models.Users, { foreignKey: "fkAssignedByUserId", as: "assignedBy" });
  };

  return TeacherSubjectAssignment;
};
