"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentLeaveRequest = sequelize.define(
    "student_leave_requests",
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
      fkRequestedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_requested_by_user_id",
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "start_date",
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "end_date",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Pending",
      },
      fkReviewedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_reviewed_by_user_id",
      },
      reviewNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "review_notes",
      },
    },
    {
      tableName: "student_leave_requests",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  StudentLeaveRequest.associate = (models) => {
    StudentLeaveRequest.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    StudentLeaveRequest.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
    StudentLeaveRequest.belongsTo(models.Users, {
      foreignKey: "fkRequestedByUserId",
      as: "requestedBy",
    });
    StudentLeaveRequest.belongsTo(models.Users, {
      foreignKey: "fkReviewedByUserId",
      as: "reviewedBy",
    });
  };

  return StudentLeaveRequest;
};
