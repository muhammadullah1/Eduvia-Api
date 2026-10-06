"use strict";

const { archivable, id, ref } = require("../utils/model_options");

module.exports = (sequelize, DataTypes) => {
  const FeePayment = sequelize.define("fee_payments", {
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
    ref: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    fkStudentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_student_id"
    },
    period: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    method: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM("Paid", "Pending"),
      allowNull: false,
      defaultValue: "Pending"
    },
    paidOn: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "paid_on"
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "due_date"
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fkRecordedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_recorded_by_user_id"
    },
    idempotencyKey: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
      field: "idempotency_key"
    },
    unallocatedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "unallocated_amount"
    },
    allocationMode: {
      type: DataTypes.ENUM("auto", "manual"),
      allowNull: false,
      defaultValue: "auto",
      field: "allocation_mode",
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
    },
  );

  FeePayment.associate = (models) => {
    FeePayment.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school"
    });
    FeePayment.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student"
    });
    FeePayment.belongsTo(models.Users, {
      foreignKey: "fkRecordedByUserId",
      as: "recordedBy"
    });
    FeePayment.hasMany(models.FeeAllocations, {
      foreignKey: "fkPaymentId",
      as: "allocations"
    });
  };

  return FeePayment;
};
