"use strict";

const { IMPORT_BATCH_STATUSES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const FeeImportBatch = sequelize.define(
    "fee_import_batches",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fileName: { type: DataTypes.STRING(255), allowNull: false, field: "file_name" },
      fileHash: { type: DataTypes.STRING(64), allowNull: true, field: "file_hash" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Validated", validate: { isIn: [IMPORT_BATCH_STATUSES] } },
      totalRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "total_rows" },
      validRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "valid_rows" },
      errorRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "error_rows" },
      duplicateRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "duplicate_rows" },
      importedRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "imported_rows" },
      totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: "total_amount" },
      fkUploadedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_uploaded_by_user_id" },
      committedAt: { type: DataTypes.DATE, allowNull: true, field: "committed_at" },
      commitKey: { type: DataTypes.STRING(120), allowNull: true, field: "commit_key" },
    },
    { tableName: "fee_import_batches", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
  );

  FeeImportBatch.associate = (models) => {
    FeeImportBatch.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    FeeImportBatch.belongsTo(models.Users, { foreignKey: "fkUploadedByUserId", as: "uploadedBy" });
    FeeImportBatch.hasMany(models.FeeImportRows, { foreignKey: "fkBatchId", as: "rows" });
  };

  return FeeImportBatch;
};
