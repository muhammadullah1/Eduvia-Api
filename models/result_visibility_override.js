"use strict";

module.exports = (sequelize, DataTypes) => {
  const ResultVisibilityOverride = sequelize.define(
    "result_visibility_overrides",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkExamId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_exam_id",
      },
      fkStudentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_student_id",
      },
      fkGrantedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_granted_by_user_id",
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      grantedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
        field: "granted_at",
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "revoked_at",
      },
      fkRevokedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_revoked_by_user_id",
      },
    },
    {
      tableName: "result_visibility_overrides",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  ResultVisibilityOverride.associate = (models) => {
    ResultVisibilityOverride.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    ResultVisibilityOverride.belongsTo(models.Exams, {
      foreignKey: "fkExamId",
      as: "exam",
    });
    ResultVisibilityOverride.belongsTo(models.Students, {
      foreignKey: "fkStudentId",
      as: "student",
    });
    ResultVisibilityOverride.belongsTo(models.Users, {
      foreignKey: "fkGrantedByUserId",
      as: "grantedBy",
    });
  };

  return ResultVisibilityOverride;
};
