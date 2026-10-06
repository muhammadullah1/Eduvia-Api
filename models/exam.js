"use strict";

module.exports = (sequelize, DataTypes) => {
  const Exam = sequelize.define("exams",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id"
      },
      fkSessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_session_id"
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_class_id"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      feeMonth: {
        type: DataTypes.STRING(7),
        allowNull: true,
        field: "fee_month"
      },
    },
    {
      tableName: "exams",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true
    }
  );

  Exam.associate = (models) => {
    Exam.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class"
    });
    Exam.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session"
    });
    Exam.hasMany(models.MarkSheets, {
      foreignKey: "fkExamId",
      as: "sheets"
    });
    Exam.hasMany(models.ResultVisibilityOverrides, {
      foreignKey: "fkExamId",
      as: "overrides"
    });
  };

  return Exam;
};
