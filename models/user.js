"use strict";

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "users",
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
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM("Male", "Female", "Other"),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM(
          "super_admin",
          "operations_manager",
          "accountant",
          "teacher",
          "parent"
        ),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "pending", "blocked"),
        defaultValue: "active",
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "date_of_birth",
      },
      photo: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_login",
      },
      archivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "archived_by",
      },
    },
    {
      tableName: "users",
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
      },
    }
  );

  User.associate = (models) => {
    User.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    User.hasOne(models.Teachers, {
      foreignKey: "fkUserId",
      as: "teacher",
    });
    User.hasOne(models.Parents, {
      foreignKey: "fkUserId",
      as: "parent",
    });
    User.hasMany(models.Expenses, {
      foreignKey: "fkRecordedByUserId",
      as: "recordedExpenses",
    });
    User.hasMany(models.FeePayments, {
      foreignKey: "fkRecordedByUserId",
      as: "recordedPayments",
    });
    User.hasMany(models.AuditLogs, {
      foreignKey: "fkUserId",
      as: "auditLogs",
    });
  };

  return User;
};
