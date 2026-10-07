"use strict";

module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    "students",
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
      fkClassId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "fk_class_id",
      },
      admissionNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "admission_no",
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "first_name",
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "last_name",
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
      bloodGroup: {
        type: DataTypes.STRING(10),
        allowNull: true,
        field: "blood_group",
      },
      admissionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "admission_date",
      },
      status: {
        type: DataTypes.ENUM(
          "Active",
          "Inactive",
          "Graduated",
          "StruckOff",
          "Withdrawn"
        ),
        allowNull: false,
        defaultValue: "Active",
      },
      discountPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: "discount_percent",
      },
      fixedMonthlyFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: "fixed_monthly_fee",
      },
      photo: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      emergencyContact: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "emergency_contact",
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "students",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
      getterMethods: {
        fullName() {
          return `${this.firstName || ""} ${this.lastName || ""}`.trim();
        },
        dob() {
          return this.getDataValue("dateOfBirth");
        },
        admittedOn() {
          return this.getDataValue("admissionDate");
        },
      },
      setterMethods: {
        dob(val) {
          this.setDataValue("dateOfBirth", val);
        },
        admittedOn(val) {
          this.setDataValue("admissionDate", val);
        },
      },
    }
  );

  Student.associate = (models) => {
    Student.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Student.belongsTo(models.Classes, {
      foreignKey: "fkClassId",
      as: "class",
    });
    Student.belongsToMany(models.Parents, {
      through: models.StudentParents,
      foreignKey: "fkStudentId",
      otherKey: "fkParentId",
      as: "parents",
    });
    Student.hasMany(models.Attendances, {
      foreignKey: "fkStudentId",
      as: "attendances",
    });
    Student.hasMany(models.FeePayments, {
      foreignKey: "fkStudentId",
      as: "payments",
    });
    Student.hasMany(models.StudentFeeMonths, {
      foreignKey: "fkStudentId",
      as: "feeMonths",
    });
    Student.hasMany(models.DailyTestResults, {
      foreignKey: "fkStudentId",
      as: "dailyTestResults",
    });
    Student.hasMany(models.MarkSheetRows, {
      foreignKey: "fkStudentId",
      as: "markSheetRows",
    });
    Student.hasMany(models.MonthlyStudentSummaries, {
      foreignKey: "fkStudentId",
      as: "monthlySummaries",
    });
    if (models.StudentLeaveRequests) {
      Student.hasMany(models.StudentLeaveRequests, {
        foreignKey: "fkStudentId",
        as: "leaveRequests",
      });
    }
    if (models.ResultVisibilityOverrides) {
      Student.hasMany(models.ResultVisibilityOverrides, {
        foreignKey: "fkStudentId",
        as: "visibilityOverrides",
      });
    }
  };

  return Student;
};
