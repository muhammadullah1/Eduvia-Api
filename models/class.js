"use strict";

module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define(
    "classes",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkSessionId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_session_id" },
      grade: { type: DataTypes.STRING, allowNull: false },
      section: { type: DataTypes.STRING, allowNull: false },
      label: { type: DataTypes.STRING, allowNull: false },
      room: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "classes",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Class.associate = (models) => {
    Class.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Class.belongsTo(models.AcademicSessions, { foreignKey: "fkSessionId", as: "session" });
    Class.hasMany(models.Students, { foreignKey: "fkClassId", as: "students" });
    Class.hasMany(models.Attendances, { foreignKey: "fkClassId", as: "attendances" });
    Class.hasMany(models.TimetableSlots, { foreignKey: "fkClassId", as: "slots" });
    Class.belongsToMany(models.Teachers, {
      through: models.TeacherClasses,
      foreignKey: "fkClassId",
      otherKey: "fkTeacherId",
      as: "teachers",
    });
  };

  return Class;
};
