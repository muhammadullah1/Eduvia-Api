"use strict";

module.exports = (sequelize, DataTypes) => {
  const School = sequelize.define(
    "schools",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      logo: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "suspended"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "schools",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        schoolName() {
          return this.getDataValue("name");
        },
      },
      setterMethods: {
        schoolName(value) {
          this.setDataValue("name", value);
        },
      },
    }
  );

  School.associate = (models) => {
    School.hasMany(models.Users, {
      foreignKey: "fkSchoolId",
      as: "users",
    });
    School.hasMany(models.AcademicSessions, {
      foreignKey: "fkSchoolId",
      as: "sessions",
    });
    School.hasMany(models.Classes, {
      foreignKey: "fkSchoolId",
      as: "classes",
    });
    School.hasMany(models.Subjects, {
      foreignKey: "fkSchoolId",
      as: "subjects",
    });
    School.hasMany(models.Students, {
      foreignKey: "fkSchoolId",
      as: "students",
    });
    School.hasMany(models.Teachers, {
      foreignKey: "fkSchoolId",
      as: "teachers",
    });
    School.hasMany(models.Parents, {
      foreignKey: "fkSchoolId",
      as: "parents",
    });
    School.hasMany(models.SchoolSettings, {
      foreignKey: "fkSchoolId",
      as: "settings",
    });
  };

  return School;
};
