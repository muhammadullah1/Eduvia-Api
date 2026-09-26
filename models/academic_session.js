"use strict";

module.exports = (sequelize, DataTypes) => {
  const AcademicSession = sequelize.define(
    "academic_sessions",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      name: { type: DataTypes.STRING, allowNull: false },
      startDate: { type: DataTypes.DATEONLY, allowNull: false, field: "start_date" },
      endDate: { type: DataTypes.DATEONLY, allowNull: false, field: "end_date" },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_current" },
    },
    {
      tableName: "academic_sessions",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  AcademicSession.associate = (models) => {
    AcademicSession.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    AcademicSession.hasMany(models.Classes, { foreignKey: "fkSessionId", as: "classes" });
  };

  return AcademicSession;
};
