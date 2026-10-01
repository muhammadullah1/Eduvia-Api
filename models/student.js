"use strict";

module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    "students",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      fkClassId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_class_id" },
      admissionNo: { type: DataTypes.STRING, allowNull: false, field: "admission_no" },
      firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
      lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
      gender: { type: DataTypes.ENUM("Male", "Female"), allowNull: true },
      dob: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM("Active", "Pending", "Withdrawn"),
        allowNull: false,
        defaultValue: "Pending",
      },
      admittedOn: { type: DataTypes.DATEONLY, allowNull: true, field: "admitted_on" },
    },
    {
      tableName: "students",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Student.associate = (models) => {
    Student.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Student.belongsTo(models.Classes, { foreignKey: "fkClassId", as: "class" });
    Student.belongsToMany(models.Parents, {
      through: models.StudentParents,
      foreignKey: "fkStudentId",
      otherKey: "fkParentId",
      as: "parents",
    });
    Student.hasMany(models.Attendances, { foreignKey: "fkStudentId", as: "attendances" });
    Student.hasMany(models.FeePayments, { foreignKey: "fkStudentId", as: "payments" });
    Student.hasMany(models.StudentFeeMonths, { foreignKey: "fkStudentId", as: "feeMonths" });
  };

  return Student;
};
