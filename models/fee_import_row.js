"use strict";

const { IMPORT_ROW_STATUSES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const FeeImportRow = sequelize.define(
    "fee_import_rows",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkBatchId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_batch_id" },
      rowNumber: { type: DataTypes.INTEGER, allowNull: false, field: "row_number" },
      admissionNo: { type: DataTypes.STRING(50), allowNull: true, field: "admission_no" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_student_id" },
      month: { type: DataTypes.STRING(255), allowNull: true },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      paymentDate: { type: DataTypes.DATEONLY, allowNull: true, field: "payment_date" },
      referenceNo: { type: DataTypes.STRING(100), allowNull: true, field: "reference_no" },
      paymentMethod: { type: DataTypes.STRING(20), allowNull: true, field: "payment_method" },
      status: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [IMPORT_ROW_STATUSES] } },
      errors: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      raw: { type: DataTypes.JSONB, allowNull: true },
      fkPaymentId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_payment_id" },
    },
    { tableName: "fee_import_rows", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
  );

  FeeImportRow.associate = (models) => {
    FeeImportRow.belongsTo(models.FeeImportBatches, { foreignKey: "fkBatchId", as: "batch" });
    FeeImportRow.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    FeeImportRow.belongsTo(models.FeePayments, { foreignKey: "fkPaymentId", as: "payment" });
  };

  return FeeImportRow;
};
