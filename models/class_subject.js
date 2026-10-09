"use strict";

module.exports = (sequelize, DataTypes) => {
  const ClassSubject = sequelize.define(
    "class_subjects",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_subject_id",
      },
      periodsPerWeek: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5,
        field: "periods_per_week",
      },
      isElective: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_elective",
      },
    },
    {
      tableName: "class_subjects",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  ClassSubject.associate = (models) => {
    ClassSubject.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    ClassSubject.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
  };

  return ClassSubject;
};
