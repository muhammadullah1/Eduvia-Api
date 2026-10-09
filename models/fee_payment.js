"use strict";

module.exports = (sequelize, DataTypes) => {
  const FeePayment = sequelize.define(
    "fee_payments",
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
      receiptNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "receipt_no",
      },
      amountPaid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: "amount_paid",
      },
      unallocatedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "unallocated_amount",
      },
      paymentMethod: {
        type: DataTypes.ENUM("Cash", "BankTransfer", "Cheque", "Online"),
        allowNull: false,
        defaultValue: "Cash",
        field: "payment_method",
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "payment_date",
      },
      referenceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "reference_no",
      },
      idempotencyKey: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "idempotency_key",
      },
      fkRecordedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_recorded_by_user_id",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "fee_payments",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        ref() {
          return this.getDataValue("receiptNo");
        },
        amount() {
          return this.getDataValue("amountPaid");
        },
        paidOn() {
          return this.getDataValue("paymentDate");
        },
        method() {
          return this.getDataValue("paymentMethod");
        },
      },
      setterMethods: {
        ref(val) {
          this.setDataValue("receiptNo", val);
        },
        amount(val) {
          this.setDataValue("amountPaid", val);
        },
        paidOn(val) {
          this.setDataValue("paymentDate", val);
        },
        method(val) {
          this.setDataValue("paymentMethod", val);
        },
      },
    }
  );

  FeePayment.associate = (models) => {
    FeePayment.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    FeePayment.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
    FeePayment.belongsTo(models.Users, {
      foreignKey: "fkRecordedByUserId",
      as: "recordedBy",
    });
    FeePayment.hasMany(models.FeeAllocations, {
      foreignKey: "fkPaymentId",
      as: "allocations",
    });
  };

  return FeePayment;
};
