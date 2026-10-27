"use strict";

const { EXPENSE_CATEGORIES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define(
    "expenses",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /** Display label, or the original free text for rows from before Step 8. */
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      categoryKey: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "category_key",
        validate: { isIn: [EXPENSE_CATEGORIES] },
      },
      referenceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "reference_no",
      },
      archiveReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "archive_reason",
      },
      fkArchivedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_archived_by_user_id",
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "expense_date",
      },
      fkRecordedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_recorded_by_user_id",
      },
      receiptUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "receipt_url",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      paymentMethod: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: "payment_method",
      },
    },
    {
      tableName: "expenses",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        date() {
          return this.getDataValue("expenseDate");
        },
      },
      setterMethods: {
        date(val) {
          this.setDataValue("expenseDate", val);
        },
      },
    }
  );

  Expense.associate = (models) => {
    Expense.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Expense.belongsTo(models.Users, {
      foreignKey: "fkRecordedByUserId",
      as: "recordedBy",
    });
  };

  return Expense;
};
