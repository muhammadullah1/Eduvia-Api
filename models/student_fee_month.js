"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentFeeMonth = sequelize.define(
    "student_fee_months",
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
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
      },
      month: {
        type: DataTypes.STRING(7),
        allowNull: false,
      },
      feeType: {
        type: DataTypes.ENUM(
          "Tuition",
          "Admission",
          "Exam",
          "Annual",
          "Transport",
          "Other"
        ),
        allowNull: false,
        defaultValue: "Tuition",
        field: "fee_type",
      },
      baseAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "base_amount",
      },
      discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "discount_amount",
      },
      netAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "net_amount",
      },
      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "paid_amount",
      },
      status: {
        type: DataTypes.ENUM("Unpaid", "Partial", "Paid"),
        allowNull: false,
        defaultValue: "Unpaid",
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "due_date",
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
      getterMethods: {
        amountDue() {
          return this.getDataValue("netAmount");
        },
        amountPaid() {
          return this.getDataValue("paidAmount");
        },
      },
      setterMethods: {
        amountDue(val) {
          this.setDataValue("netAmount", val);
        },
        amountPaid(val) {
          this.setDataValue("paidAmount", val);
        },
      },
    }
  );

  StudentFeeMonth.associate = (models) => {
    StudentFeeMonth.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    StudentFeeMonth.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
    StudentFeeMonth.hasMany(models.FeeAllocations, {
      foreignKey: "fkFeeMonthId",
      as: "allocations",
    });
  };

  return StudentFeeMonth;
};
