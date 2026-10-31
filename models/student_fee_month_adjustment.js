"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentFeeMonthAdjustment = sequelize.define(
    "student_fee_month_adjustments",
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
        validate: {
          isInt: true,
        },
      },
      fkFeeMonthId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_fee_month_id",
        validate: {
          isInt: true,
        },
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
        validate: {
          isInt: true,
        },
      },
      deltaCollectible: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "delta_collectible",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "PendingApproval",
        validate: {
          isIn: [["Draft", "PendingApproval", "Approved", "Rejected", "Voided"]],
        },
      },
      fkRequestedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_requested_by_user_id",
        validate: {
          isInt: true,
        },
      },
      fkApprovedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_approved_by_user_id",
        validate: {
          isInt: true,
        },
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "approved_at",
      },
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "rejection_reason",
      },
    },
    {
      tableName: "student_fee_month_adjustments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  StudentFeeMonthAdjustment.associate = (models) => {
    StudentFeeMonthAdjustment.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    StudentFeeMonthAdjustment.belongsTo(models.StudentFeeMonths, {
      foreignKey: "fkFeeMonthId",
      as: "feeMonth",
    });
    StudentFeeMonthAdjustment.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
  };

  return StudentFeeMonthAdjustment;
};
