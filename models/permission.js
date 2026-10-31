"use strict";

module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    "permissions",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      risk: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
          isIn: [["low", "medium", "high"]],
        },
      },
      assignableRoles: {
        type: DataTypes.ARRAY(DataTypes.STRING(40)),
        allowNull: false,
        defaultValue: [],
        field: "assignable_roles",
      },
    },
    {
      tableName: "permissions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  Permission.associate = (models) => {
    Permission.hasMany(models.RolePermissions, {
      foreignKey: "permissionKey",
      sourceKey: "key",
      as: "grants",
    });
  };

  return Permission;
};
