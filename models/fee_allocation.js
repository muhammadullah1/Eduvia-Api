"use strict";

module.exports = (sequelize, DataTypes) => {
  const FeeAllocation = sequelize.define("fee_allocations",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id"
      },
      fkPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_payment_id"
      },
      fkFeeMonthId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_fee_month_id"
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
    },
    {
      tableName: "fee_allocations",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true
    }
  );

  FeeAllocation.associate = (models) => {
    FeeAllocation.belongsTo(models.FeePayments, {
      foreignKey: "fkPaymentId",
      as: "payment"
    });
    FeeAllocation.belongsTo(models.StudentFeeMonths, {
      foreignKey: "fkFeeMonthId",
      as: "feeMonth"
    });
  };

  return FeeAllocation;
};
