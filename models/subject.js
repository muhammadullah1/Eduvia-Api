"use strict";

module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define(
    "subjects",
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
      },
    },
    {
      tableName: "subjects",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  Subject.associate = (models) => {
    Subject.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Subject.hasMany(models.Teachers, {
      foreignKey: "fkSubjectId",
      as: "teachers",
    });
    if (models.ClassSubjects) {
      Subject.belongsToMany(models.Classes, {
        through: models.ClassSubjects,
        foreignKey: "fkSubjectId",
        otherKey: "fkClassId",
        as: "classes",
      });
    }
    Subject.hasMany(models.TimetableSlots, {
      foreignKey: "fkSubjectId",
      as: "timetableSlots",
    });
    Subject.hasMany(models.MarkSheets, {
      foreignKey: "fkSubjectId",
      as: "markSheets",
    });
    Subject.hasMany(models.PlannedChapters, {
      foreignKey: "fkSubjectId",
      as: "plannedChapters",
    });
    Subject.hasMany(models.DailyLessons, {
      foreignKey: "fkSubjectId",
      as: "dailyLessons",
    });
    Subject.hasMany(models.DailyTests, {
      foreignKey: "fkSubjectId",
      as: "dailyTests",
    });
  };

  return Subject;
};
