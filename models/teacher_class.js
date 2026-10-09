"use strict";

module.exports = (sequelize, DataTypes) => {
  const TeacherClass = sequelize.define(
    "teacher_classes",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_teacher_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      role: {
        type: DataTypes.ENUM("ClassTeacher", "SubjectTeacher"),
        allowNull: false,
        defaultValue: "SubjectTeacher",
      },
    },
    {
      tableName: "teacher_classes",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  TeacherClass.associate = (models) => {
    TeacherClass.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    TeacherClass.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
  };

  return TeacherClass;
};
