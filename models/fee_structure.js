"use strict";

const { FEE_TYPES, FEE_FREQUENCIES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const FeeStructure = sequelize.define(
    "fee_structures",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_session_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      feeType: { type: DataTypes.STRING(20), allowNull: false, field: "fee_type", validate: { isIn: [FEE_TYPES] } },
      frequency: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [FEE_FREQUENCIES] } },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } },
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false, field: "effective_from" },
      fkUpdatedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_updated_by_user_id" },
      removedReason: { type: DataTypes.TEXT, allowNull: true, field: "removed_reason" },
      fkRemovedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_removed_by_user_id" },
    },
    { tableName: "fee_structures", paranoid: true, timestamps: true, createdAt: "created_at", updatedAt: "updated_at", deletedAt: "archived_at", underscored: true },
  );

  FeeStructure.associate = (models) => {
    FeeStructure.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    FeeStructure.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
    FeeStructure.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    FeeStructure.belongsTo(models.Users, { foreignKey: "fkUpdatedByUserId", as: "updatedBy" });
    FeeStructure.belongsTo(models.Users, { foreignKey: "fkRemovedByUserId", as: "removedBy" });
  };

  return FeeStructure;
};
