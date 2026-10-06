"use strict";

module.exports = (sequelize, DataTypes) => {
  const StudentParent = sequelize.define("student_parents", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    fkStudentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_student_id"
    },
    fkParentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "fk_parent_id"
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_primary"
    },
  },
    {
      tableName: "student_parents",
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  return StudentParent;
};
