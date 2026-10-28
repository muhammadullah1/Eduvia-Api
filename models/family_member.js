"use strict";

module.exports = (sequelize, DataTypes) => {
  const FamilyMember = sequelize.define(
    "family_members",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkFamilyId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_family_id" },
      fkStudentId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_student_id" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Active" },
      linkedVia: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "manual", field: "linked_via" },
    },
    {
      tableName: "family_members",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  FamilyMember.associate = (models) => {
    FamilyMember.belongsTo(models.Families, { foreignKey: "fkFamilyId", as: "family" });
    FamilyMember.belongsTo(models.Students, { foreignKey: "fkStudentId", as: "student" });
  };

  return FamilyMember;
};
