"use strict";

const { USER_ROLES } = require("../constants");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("users", {
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
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "first_name"
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "last_name"
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female", "Other"),
      allowNull: true
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM(...Object.values(USER_ROLES)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "in_active", "pending", "block"),
      defaultValue: "in_active",
      allowNull: false,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_login"
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "date_of_birth"
    },
    archivedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "archived_by"
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
    },
  );

  User.associate = (models) => {
    User.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school"
    });
    User.hasOne(models.Teachers, {
      foreignKey: "fkUserId",
      as: "teacher"
    });
    User.hasOne(models.Parents, {
      foreignKey: "fkUserId",
      as: "parent"
    });
  };

  return User;
};
