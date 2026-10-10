"use strict";

module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define(
    "applications",
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
      applicantFirstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "applicant_first_name",
      },
      applicantLastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "applicant_last_name",
      },
      gender: {
        type: DataTypes.ENUM("Male", "Female", "Other"),
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "date_of_birth",
      },
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_class_id",
      },
      gradeApplyingFor: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "grade_applying_for",
      },
      parentName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "parent_name",
      },
      parentEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "parent_email",
      },
      parentPhone: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "parent_phone",
      },
      status: {
        type: DataTypes.ENUM("New", "Review", "Waitlist", "Enrolled", "Rejected"),
        allowNull: false,
        defaultValue: "New",
      },
      decision: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      previousSchool: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "previous_school",
      },
      previousClass: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "previous_class",
      },
      guardianRelation: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "guardian_relation",
      },
      guardianAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "guardian_address",
      },
      interviewType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "interview_type",
      },
      interviewDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "interview_date",
      },
      interviewScore: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: "interview_score",
      },
      interviewResult: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "interview_result",
      },
      submittedOn: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "submitted_on",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      enrolledStudentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "enrolled_student_id",
      },
    },
    {
      tableName: "applications",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        name() {
          return `${this.applicantFirstName || ""} ${this.applicantLastName || ""}`.trim();
        },
        guardian() {
          return this.getDataValue("parentName");
        },
        phone() {
          return this.getDataValue("parentPhone");
        },
        dob() {
          return this.getDataValue("dateOfBirth");
        },
      },
    }
  );

  Application.associate = (models) => {
    Application.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Application.belongsTo(models.AcademicSessions, {
      foreignKey: "fkSessionId",
      as: "session",
    });
    Application.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    Application.belongsTo(models.Students, {
      foreignKey: "enrolledStudentId",
      as: "enrolledStudent",
    });
    Application.hasMany(models.ApplicationDocuments, {
      foreignKey: "fkApplicationId",
      as: "documents",
    });
  };

  return Application;
};
