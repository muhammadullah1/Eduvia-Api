"use strict";

const { archivable, id, ref } = require("../utils/model_options");

/** Monthly fee ledger line per student (UR-09). `month` is the 1st of the month. */
module.exports = (sequelize, DataTypes) => {
  const StudentFeeMonth = sequelize.define(
    "student_fee_months",
    {
      id: id(DataTypes),
      fkSchoolId: ref(DataTypes, "fk_school_id"),
      fkStudentId: ref(DataTypes, "fk_student_id"),
      month: { type: DataTypes.DATEONLY, allowNull: false },
      feeType: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "Tuition", field: "fee_type" },
      amountDue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "amount_due" },
      amountPaid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: "amount_paid" },
      status: {
        type: DataTypes.ENUM("Unpaid", "Partially Paid", "Paid", "Advance"),
        allowNull: false,
        defaultValue: "Unpaid",
      },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true, field: "due_date" },
    },
    archivable("student_fee_months"),
  );

  StudentFeeMonth.associate = (models) => {
    StudentFeeMonth.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    StudentFeeMonth.hasMany(models.FeeAllocations, { foreignKey: "fkFeeMonthId", as: "allocations" });
  };

  return StudentFeeMonth;
};
