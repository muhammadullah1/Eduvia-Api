"use strict";

module.exports = (sequelize, DataTypes) => {
  const FeeAllocation = sequelize.define(
    "fee_allocations",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_payment_id",
      },
      fkFeeMonthId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_fee_month_id",
      },
      allocatedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "allocated_amount",
      },
    },
    {
      tableName: "fee_allocations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      getterMethods: {
        amount() {
          return this.getDataValue("allocatedAmount");
        },
      },
      setterMethods: {
        amount(val) {
          this.setDataValue("allocatedAmount", val);
        },
      },
    }
  );

  FeeAllocation.associate = (models) => {
    FeeAllocation.belongsTo(models.FeePayments, {
      foreignKey: "fkPaymentId",
      as: "payment",
    });
    FeeAllocation.belongsTo(models.StudentFeeMonths, {
      foreignKey: "fkFeeMonthId",
      as: "feeMonth",
    });
  };

  return FeeAllocation;
};
