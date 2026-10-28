"use strict";

module.exports = (sequelize, DataTypes) => {
  const Family = sequelize.define(
    "families",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkSchoolId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_school_id" },
      displayName: { type: DataTypes.STRING(150), allowNull: false, field: "display_name" },
      fkPrimaryParentId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_primary_parent_id" },
      verifiedAt: { type: DataTypes.DATE, allowNull: true, field: "verified_at" },
      fkVerifiedByUserId: { type: DataTypes.INTEGER, allowNull: true, field: "fk_verified_by_user_id" },
    },
    {
      tableName: "families",
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "archived_at",
      underscored: true,
    },
  );

  Family.associate = (models) => {
    Family.belongsTo(models.Schools, { foreignKey: "fkSchoolId", as: "school" });
    Family.belongsTo(models.Parents, { foreignKey: "fkPrimaryParentId", as: "primaryParent" });
    Family.belongsTo(models.Users, { foreignKey: "fkVerifiedByUserId", as: "verifiedBy" });
    Family.hasMany(models.FamilyMembers, { foreignKey: "fkFamilyId", as: "members" });
  };

  return Family;
};
