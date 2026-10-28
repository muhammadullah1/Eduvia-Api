"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentFeeConcession = sequelize.define(
    "student_fee_concessions",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_session_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      fkFamilyId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_family_id" },
      category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "Standard" },
      mode: { type: DataTypes.STRING(30), allowNull: false },
      value: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
      stackable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      maxDiscountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: "max_discount_amount" },
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false, field: "effective_from" },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true, field: "effective_to" },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "Draft" },
      reason: { type: DataTypes.TEXT, allowNull: true },
      fkRequestedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_requested_by_user_id" },
      fkApprovedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_approved_by_user_id" },
      approvedAt: { type: DataTypes.DATE, allowNull: true, field: "approved_at" },
      rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: "rejection_reason" },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "student_fee_concessions",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  StudentFeeConcession.associate = (models) => {
    StudentFeeConcession.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    StudentFeeConcession.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
    StudentFeeConcession.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    StudentFeeConcession.belongsTo(models.Families, { foreignKey: "fkFamilyId", as: "family" });
    StudentFeeConcession.hasMany(models.StudentFeeConcessionFeeTypes, { foreignKey: "fkConcessionId", as: "feeTypes" });
    StudentFeeConcession.hasMany(models.StudentFeeConcessionEvents, { foreignKey: "fkConcessionId", as: "events" });
  };

  return StudentFeeConcession;
};
