"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherClass = sequelize.define(
    "teacher_classes",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkTeacherId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_teacher_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_class_id" },
    },
    {
      tableName: "teacher_classes",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  return TeacherClass;
};
