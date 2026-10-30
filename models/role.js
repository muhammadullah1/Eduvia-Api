"use strict";

module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    "roles",
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
      key: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      portal: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["admin", "teacher", "parent"]],
        },
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_system",
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          isInt: true,
          min: 1,
        },
      },
    },
    {
      tableName: "roles",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  Role.associate = (models) => {
    Role.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Role.hasMany(models.RolePermissions, {
      foreignKey: "fkRoleId",
      as: "grants",
    });
  };

  return Role;
};
