"use strict";

module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define("applications", {
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
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fkClassId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fk_class_id"
    },
    guardian: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female"),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    previousSchool: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "previous_school"
    },
    previousClass: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "previous_class"
    },
    guardianRelation: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "guardian_relation"
    },
    guardianAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "guardian_address"
    },
    interviewType: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "interview_type"
    },
    interviewDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "interview_date"
    },
    interviewScore: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "interview_score"
    },
    interviewResult: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "interview_result"
    },
    decision: {
      type: DataTypes.ENUM("Admit", "Reject", "Waitlist"),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM("New", "Review", "Waitlist", "Enrolled", "Rejected"),
      allowNull: false,
      defaultValue: "New",
    },
    submittedOn: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "submitted_on"
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
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
    },
  );

  Application.associate = (models) => {
    Application.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school"
    });
    Application.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class"
    });
    Application.hasMany(models.ApplicationDocuments, {
      foreignKey: "fkApplicationId",
      as: "documents",
    });
  };

  return Application;
};
