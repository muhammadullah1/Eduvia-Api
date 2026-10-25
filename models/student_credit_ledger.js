"use strict";

const { CREDIT_ENTRY_TYPES, CREDIT_SOURCES } = require("../constants/finance");

/** Append-only: one row per credit movement. Credit is applied to future fees only (no refunds). */
module.exports = (sequelize, DataTypes) => {
  const StudentCreditLedger = sequelize.define(
    "student_credit_ledger",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      entryType: { type: DataTypes.STRING(20), allowNull: false, field: "entry_type", validate: { isIn: [CREDIT_ENTRY_TYPES] } },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } },
      source: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "payment", validate: { isIn: [CREDIT_SOURCES] } },
      fkPaymentId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_payment_id" },
      fkFeeMonthId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_fee_month_id" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      fkCreatedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_created_by_user_id" },
    },
    { tableName: "student_credit_ledger", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
  );

  StudentCreditLedger.associate = (models) => {
    StudentCreditLedger.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    StudentCreditLedger.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    StudentCreditLedger.belongsTo(models.FeePayments, { foreignKey: "fkPaymentId", as: "payment" });
    StudentCreditLedger.belongsTo(models.StudentFeeMonths, { foreignKey: "fkFeeMonthId", as: "feeMonth" });
    StudentCreditLedger.belongsTo(models.Users, { foreignKey: "fkCreatedByUserId", as: "createdBy" });
  };

  return StudentCreditLedger;
};
