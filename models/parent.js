"use strict";

module.exports = (sequelize, DataTypes) => {
  const Parent = sequelize.define(
    "parents",
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
      fatherName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "father_name",
      },
      motherName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "mother_name",
      },
      primaryContactNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "primary_contact_number",
      },
      occupation: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      cnic: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "parents",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    }
  );

  Parent.associate = (models) => {
    Parent.belongsTo(models.Users, {
      foreignKey: "fkUserId",
      as: "user",
    });
    Parent.belongsTo(models.Schools, {
      foreignKey: "fkSchoolId",
      as: "school",
    });
    Parent.belongsToMany(models.Students, {
      through: models.StudentParents,
      foreignKey: "fkParentId",
      otherKey: "fkStudentId",
      as: "students",
    });
  };

  return Parent;
};
