"use strict";

const { PAYMENT_METHODS, INCOME_CATEGORIES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const OtherIncome = sequelize.define(
    "other_incomes",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      title: { type: DataTypes.STRING(255), allowNull: false },
      category: { type: DataTypes.STRING(100), allowNull: false },
      categoryKey: { type: DataTypes.STRING(20), allowNull: false, field: "category_key", validate: { isIn: [INCOME_CATEGORIES] } },
      archiveReason: { type: DataTypes.TEXT, allowNull: true, field: "archive_reason" },
      fkArchivedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_archived_by_user_id" },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } },
      incomeDate: { type: DataTypes.DATEONLY, allowNull: false, field: "income_date" },
      paymentMethod: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Cash", field: "payment_method", validate: { isIn: [PAYMENT_METHODS] } },
      referenceNo: { type: DataTypes.STRING(100), allowNull: true, field: "reference_no" },
      receivedFrom: { type: DataTypes.STRING(255), allowNull: true, field: "received_from" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      fkRecordedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_recorded_by_user_id" },
    },
    { tableName: "other_incomes", paranoid: true, timestamps: true, createdAt: "created_at", updatedAt: "updated_at", deletedAt: "archived_at", underscored: true },
  );

  OtherIncome.associate = (models) => {
    OtherIncome.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    OtherIncome.belongsTo(models.Users, { foreignKey: "fkRecordedByUserId", as: "recordedBy" });
  };

  return OtherIncome;
};
