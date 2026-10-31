"use strict";

module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    "role_permissions",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkRoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_role_id",
        validate: {
          isInt: true,
        },
      },
      permissionKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "permission_key",
      },
      fkGrantedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_granted_by_user_id",
        validate: {
          isInt: true,
        },
      },
    },
    {
      tableName: "role_permissions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Roles, {
      foreignKey: "fkRoleId",
      as: "role",
    });
    RolePermission.belongsTo(models.Permissions, {
      foreignKey: "permissionKey",
      targetKey: "key",
      as: "permission",
    });
    RolePermission.belongsTo(models.Users, {
      foreignKey: "fkGrantedByUserId",
      as: "grantedBy",
    });
  };

  return RolePermission;
};
