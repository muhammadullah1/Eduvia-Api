"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** Audited manual release of a fee-gated result; never touches marks (BR-10). */
module.exports = (sequelize, DataTypes) => {
  const ResultVisibilityOverride = sequelize.define(
    "result_visibility_overrides",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkExamId: ref(DataTypes, "fk_exam_id"),
      fkStudentId: ref(DataTypes, "fk_student_id"),
      reason: { type: DataTypes.TEXT, allowNull: false },
      fkGrantedByUserId: ref(DataTypes, "fk_granted_by_user_id"),
      grantedAt: { type: DataTypes.DATE, allowNull: false, field: "granted_at" },
      revokedAt: { type: DataTypes.DATE, allowNull: true, field: "revoked_at" },
      fkRevokedByUserId: ref(DataTypes, "fk_revoked_by_user_id", true),
    },
    archivable("result_visibility_overrides"),
  );

  ResultVisibilityOverride.associate = (models) => {
    ResultVisibilityOverride.belongsTo(models.Exams, { foreignKey: "fkExamId", as: "exam" });
    ResultVisibilityOverride.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    ResultVisibilityOverride.belongsTo(models.Users, { foreignKey: "fkGrantedByUserId", as: "grantedBy" });
  };

  return ResultVisibilityOverride;
};
