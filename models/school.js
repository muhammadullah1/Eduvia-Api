"use strict";

module.exports = (sequelize, DataTypes) => {
  const School = sequelize.define(
    "schools",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      schoolName: { type: DataTypes.STRING, allowNull: false, field: "school_name" },
      phone: { type: DataTypes.STRING, allowNull: false },
      address: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      website: { type: DataTypes.STRING, allowNull: true },
      logo: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "schools",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  School.associate = (models) => {
    School.hasMany(models.Users, { foreignKey: "fkSchoolId", as: "users" });
    School.hasMany(models.AcademicSessions, { foreignKey: "fkSchoolId", as: "sessions" });
    School.hasMany(models.Classes, { foreignKey: "fkSchoolId", as: "classes" });
    School.hasMany(models.Subjects, { foreignKey: "fkSchoolId", as: "subjects" });
    School.hasMany(models.Students, { foreignKey: "fkSchoolId", as: "students" });
  };

  return School;
};
