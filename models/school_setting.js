"use strict";

module.exports = (sequelize, DataTypes) => {
  const SchoolSetting = sequelize.define(
    "school_settings",
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
      key: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      value: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      fkUpdatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_updated_by_user_id",
      },
    },
    {
      tableName: "school_settings",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  SchoolSetting.associate = (models) => {
    SchoolSetting.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    SchoolSetting.belongsTo(models.Users, {
      foreignKey: "fkUpdatedByUserId",
      as: "updatedBy",
    });
  };

  return SchoolSetting;
};
