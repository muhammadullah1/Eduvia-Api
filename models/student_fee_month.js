"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentFeeMonth = sequelize.define("student_fee_months", {
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
    fkStudentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_student_id"
    },
    month: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    feeType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "Tuition",
      field: "fee_type"
    },
    amountDue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "amount_due"
    },
    amountPaid: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "amount_paid"
    },
    status: {
      type: DataTypes.ENUM("Unpaid", "Partially Paid", "Paid", "Advance"),
      allowNull: false,
      defaultValue: "Unpaid",
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "due_date"
    },
  },
    {
      tableName: "student_fee_months",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  StudentFeeMonth.associate = (models) => {
    StudentFeeMonth.belongsTo(models.Students, {
      foreignKey: "fkStudentId", as: "student"
    });
    StudentFeeMonth.hasMany(models.FeeAllocations, {
      foreignKey: "fkFeeMonthId", as: "allocations"
    });
  };

  return StudentFeeMonth;
};
