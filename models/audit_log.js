"use strict";

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "audit_logs",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      actorUserId: { type: DataTypes.INTEGER, allowNull: true, field: "actor_user_id" },
      actorLabel: { type: DataTypes.STRING, allowNull: false, field: "actor_label" },
      action: { type: DataTypes.STRING, allowNull: false },
      at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "audit_logs",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    AuditLog.belongsTo(models.Users, { foreignKey: "actorUserId", as: "actor" });
  };

  return AuditLog;
};
