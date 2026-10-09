"use strict";

module.exports = (sequelize, DataTypes) => {
  const DailyTest = sequelize.define(
    "daily_tests",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fkSchoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_school_id",
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
      fkTeacherId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fk_teacher_id",
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      totalMarks: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 20.0,
        field: "total_marks",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "daily_tests",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        maxScore() {
          return this.getDataValue("totalMarks");
        },
      },
      setterMethods: {
        maxScore(val) {
          this.setDataValue("totalMarks", val);
        },
      },
    }
  );

  DailyTest.associate = (models) => {
    DailyTest.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    DailyTest.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    DailyTest.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    DailyTest.belongsTo(models.Teachers, {
      foreignKey: "fkTeacherId",
      as: "teacher",
    });
    DailyTest.hasMany(models.DailyTestResults, {
      foreignKey: "fkDailyTestId",
      as: "results",
    });
  };

  return DailyTest;
};
