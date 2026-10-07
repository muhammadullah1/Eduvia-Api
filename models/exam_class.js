"use strict";

module.exports = (sequelize, DataTypes) => {
  const ExamClass = sequelize.define(
    "exam_classes",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkExamId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_exam_id",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
    },
    {
      tableName: "exam_classes",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  ExamClass.associate = (models) => {
    ExamClass.belongsTo(models.Exams, {
      foreignKey: "fkExamId",
      as: "exam",
    });
    ExamClass.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
  };

  return ExamClass;
};
