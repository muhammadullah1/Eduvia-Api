"use strict";

module.exports = (sequelize, DataTypes) => {
  const Parent = sequelize.define(
    "parents",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkUserId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "fk_user_id" },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      relation: { type: DataTypes.STRING, allowNull: false, defaultValue: "Guardian" },
    },
    {
      tableName: "parents",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Parent.associate = (models) => {
    Parent.belongsTo(models.Users, { foreignKey: "fkUserId", as: "user" });
    Parent.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Parent.belongsToMany(models.Students, {
      through: models.StudentParents,
      foreignKey: "fkParentId",
      otherKey: "fkStudentId",
      as: "students",
    });
  };

  return Parent;
};
