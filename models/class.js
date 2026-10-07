"use strict";

module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define(
    "classes",
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
      grade: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      section: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      room: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      periodCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 8,
        field: "period_count",
      },
      monthlyTuitionFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "monthly_tuition_fee",
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 50,
      },
      status: {
        type: Sequelize => DataTypes.ENUM("Active", "Archived"),
        type: DataTypes.ENUM("Active", "Archived"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      tableName: "classes",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        monthlyFee() {
          return this.getDataValue("monthlyTuitionFee");
        },
      },
      setterMethods: {
        monthlyFee(val) {
          this.setDataValue("monthlyTuitionFee", val);
        },
      },
    }
  );

  Class.associate = (models) => {
    Class.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Class.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
    Class.hasMany(models.Students, {
      foreignKey: "fkClassId",
      as: "students",
    });
    Class.hasMany(models.Attendances, {
      foreignKey: "fkClassId",
      as: "attendances",
    });
    Class.hasMany(models.TimetableSlots, {
      foreignKey: "fkClassId",
      as: "slots",
    });
    Class.hasMany(models.DailyLessons, {
      foreignKey: "fkClassId",
      as: "dailyLessons",
    });
    Class.hasMany(models.PlannedChapters, {
      foreignKey: "fkClassId",
      as: "plannedChapters",
    });
    Class.hasMany(models.DailyTests, {
      foreignKey: "fkClassId",
      as: "dailyTests",
    });
    Class.hasMany(models.DailyTestSchedules, {
      foreignKey: "fkClassId",
      as: "dailyTestSchedules",
    });
    Class.belongsToMany(models.Teachers, {
      through: models.TeacherClasses,
      foreignKey: "fkClassId",
      otherKey: "fkTeacherId",
      as: "teachers",
    });
    if (models.ClassSubjects) {
      Class.belongsToMany(models.Subjects, {
        through: models.ClassSubjects,
        foreignKey: "fkClassId",
        otherKey: "fkSubjectId",
        as: "subjects",
      });
    }
    if (models.ExamClasses) {
      Class.belongsToMany(models.Exams, {
        through: models.ExamClasses,
        foreignKey: "fkClassId",
        otherKey: "fkExamId",
        as: "exams",
      });
    }
  };

  return Class;
};
