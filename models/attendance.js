"use strict";

module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "attendances",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.ENUM("Present", "Absent", "Leave"), allowNull: false },
    },
    {
      tableName: "attendances",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
    Attendance.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
  };

  return Attendance;
};
