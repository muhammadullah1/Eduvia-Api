"use strict";

module.exports = (sequelize, DataTypes) => {
  const Teacher = sequelize.define(
    "teachers",
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
      fkUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: "fk_user_id",
      },
      fkSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_subject_id",
      },
      employeeCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "employee_code",
      },
      qualification: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      joiningDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "joining_date",
      },
      status: {
        type: DataTypes.ENUM("Active", "OnLeave", "Resigned", "Terminated"),
        allowNull: false,
        defaultValue: "Active",
      },
      monthlySalary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: "monthly_salary",
      },
    },
    {
      tableName: "teachers",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  Teacher.associate = (models) => {
    Teacher.belongsTo(models.Users, {
      foreignKey: "fkUserId",
      as: "user",
    });
    Teacher.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Teacher.belongsTo(models.Subjects, {
      foreignKey: "fkSubjectId",
      as: "subject",
    });
    Teacher.hasMany(models.TeacherSubjectAssignments, {
      foreignKey: "fkTeacherId",
      as: "subjectHistory",
    });
    Teacher.hasMany(models.TeacherClasses, {
      foreignKey: "fkTeacherId",
      as: "teacherClasses",
    });
    Teacher.hasMany(models.TimetableSlots, {
      foreignKey: "fkTeacherId",
      as: "timetableSlots",
    });
    Teacher.hasMany(models.TeacherAbsences, {
      foreignKey: "fkTeacherId",
      as: "absences",
    });
    Teacher.hasMany(models.SubstituteAssignments, {
      foreignKey: "fkSubstituteTeacherId",
      as: "substituteAssignments",
    });
    Teacher.hasMany(models.DailyLessons, {
      foreignKey: "fkTeacherId",
      as: "dailyLessons",
    });
    Teacher.hasMany(models.DailyTests, {
      foreignKey: "fkTeacherId",
      as: "dailyTests",
    });
  };

  return Teacher;
};
