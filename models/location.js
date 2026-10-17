"use strict";

module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define(
    "locations",
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
      fkSessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_session_id",
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      locationCode: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "location_code",
      },
      locationType: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "location_type",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "locations",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Location.associate = (models) => {
    Location.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Location.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
  };

  return Location;
};
