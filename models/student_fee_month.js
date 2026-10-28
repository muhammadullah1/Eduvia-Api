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
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "base_amount",
      },
      discountAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "discount_amount",
      },
      netAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "net_amount",
      },
      paidAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "paid_amount",
      },
      status: {
        type: DataTypes.ENUM("Unpaid", "Partially Paid", "Paid", "Advance"),
        allowNull: false,
        defaultValue: "Unpaid",
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "due_date",
      },
      adjustmentTotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "adjustment_total",
      },
      collectibleAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: "collectible_amount",
      },
      concessionSnapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: "concession_snapshot",
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
      hooks: {
        beforeValidate(instance) {
          if (!instance.isNewRecord) return;
          let net = instance.netAmount;
          if (net == null) net = instance.getDataValue("netAmount");
          if (net == null) return;
          // Mirror net unless the caller explicitly set collectibleAmount.
          if (!instance.changed("collectibleAmount")) {
            instance.setDataValue("collectibleAmount", net);
          }
        },
      },
      getterMethods: {
        amountDue() {
          const collectible = this.getDataValue("collectibleAmount");
          if (collectible != null) return collectible;
          return this.getDataValue("netAmount");
        },
        amountPaid() {
          return this.getDataValue("paidAmount");
        },
      },
      setterMethods: {
        amountDue(val) {
          this.setDataValue("collectibleAmount", val);
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
    StudentFeeMonth.hasMany(models.StudentFeeMonthAdjustments, {
      foreignKey: "fkFeeMonthId",
      as: "adjustments",
    });
  };

  return StudentFeeMonth;
};
