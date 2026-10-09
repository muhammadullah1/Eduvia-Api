"use strict";

module.exports = (sequelize, DataTypes) => {
  const Exam = sequelize.define(
    "exams",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
      },
      fkSessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_session_id",
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "start_date",
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "end_date",
      },
      status: {
        type: DataTypes.ENUM("Draft", "Published", "Archived"),
        allowNull: false,
        defaultValue: "Draft",
      },
      requiredFeeMonth: {
        type: DataTypes.STRING(7),
        allowNull: true,
        field: "required_fee_month",
      },
    },
    {
      tableName: "exams",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        feeMonth() {
          return this.getDataValue("requiredFeeMonth");
        },
      },
      setterMethods: {
        feeMonth(val) {
          this.setDataValue("requiredFeeMonth", val);
        },
      },
    }
  );

  Exam.associate = (models) => {
    Exam.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Exam.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
    if (models.ExamClasses) {
      Exam.belongsToMany(models.Classes, {
        through: models.ExamClasses,
        foreignKey: "fkExamId",
        otherKey: "fkClassId",
        as: "classes",
      });
    }
    Exam.hasMany(models.MarkSheets, {
      foreignKey: "fkExamId",
      as: "markSheets",
    });
    if (models.ResultVisibilityOverrides) {
      Exam.hasMany(models.ResultVisibilityOverrides, {
        foreignKey: "fkExamId",
        as: "visibilityOverrides",
      });
    }
  };

  return Exam;
};
