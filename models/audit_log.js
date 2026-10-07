"use strict";

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "audit_logs",
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
      fkUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_user_id",
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entityType: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "entity_type",
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "entity_id",
      },
      oldValues: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: "old_values",
      },
      newValues: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: "new_values",
      },
      ipAddress: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "ip_address",
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "user_agent",
      },
    },
    {
      tableName: "audit_logs",
      timestamps: true,
      updatedAt: false,
      createdAt: "created_at",
      underscored: true,
      getterMethods: {
        actorUserId() {
          return this.getDataValue("fkUserId");
        },
      },
      setterMethods: {
        actorUserId(val) {
          this.setDataValue("fkUserId", val);
        },
      },
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    AuditLog.belongsTo(models.Users, {
      foreignKey: "fkUserId",
      as: "user",
    });
  };

  return AuditLog;
};
