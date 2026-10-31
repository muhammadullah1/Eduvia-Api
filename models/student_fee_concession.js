"use strict";

const { CONCESSION_MODES, CONCESSION_STATUSES } = require("../constants/concessions");
const { FEE_TYPES } = require("../constants/finance");

module.exports = (sequelize, DataTypes) => {
  const StudentFeeConcession = sequelize.define(
    "student_fee_concessions",
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
      fkSessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_session_id",
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
      fkFamilyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_family_id",
        validate: {
          isInt: true,
        },
      },
      fkReasonId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_reason_id",
        validate: {
          isInt: true,
        },
      },
      fkReplacesId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_replaces_id",
        validate: {
          isInt: true,
        },
      },
      feeType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Tuition",
        field: "fee_type",
        validate: {
          isIn: [FEE_TYPES],
        },
      },
      category: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "Standard",
      },
      mode: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: [CONCESSION_MODES],
        },
      },
      value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
        validate: {
          isInt: true,
        },
      },
      stackable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      maxDiscountAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: "max_discount_amount",
      },
      effectiveFrom: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "effective_from",
      },
      effectiveTo: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "effective_to",
      },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "PendingApproval",
        validate: {
          isIn: [CONCESSION_STATUSES],
        },
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "student_fee_concessions",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  StudentFeeConcession.associate = (models) => {
    StudentFeeConcession.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    StudentFeeConcession.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
    StudentFeeConcession.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
    StudentFeeConcession.belongsTo(models.Families, {
      foreignKey: "fkFamilyId",
      as: "family",
    });
    StudentFeeConcession.belongsTo(models.SchoolConcessionReasons, {
      foreignKey: "fkReasonId",
      as: "reasonRow",
    });
    StudentFeeConcession.belongsTo(models.StudentFeeConcessions, {
      foreignKey: "fkReplacesId",
      as: "replaces",
    });
    StudentFeeConcession.hasMany(models.StudentFeeConcessionFeeTypes, {
      foreignKey: "fkConcessionId",
      as: "feeTypes",
    });
    StudentFeeConcession.hasMany(models.StudentFeeConcessionEvents, {
      foreignKey: "fkConcessionId",
      as: "events",
    });
  };

  return StudentFeeConcession;
};
