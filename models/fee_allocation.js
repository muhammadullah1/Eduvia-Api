"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** Links a payment (receipt) to the fee months it cleared (BR-12). */
module.exports = (sequelize, DataTypes) => {
  const FeeAllocation = sequelize.define(
    "fee_allocations",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkPaymentId: ref(DataTypes, "fk_payment_id"),
      fkFeeMonthId: ref(DataTypes, "fk_fee_month_id"),
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    archivable("fee_allocations"),
  );

  FeeAllocation.associate = (models) => {
    FeeAllocation.belongsTo(models.FeePayments, { foreignKey: "fkPaymentId", as: "payment" });
    FeeAllocation.belongsTo(models.StudentFeeMonths, { foreignKey: "fkFeeMonthId", as: "feeMonth" });
  };

  return FeeAllocation;
};
