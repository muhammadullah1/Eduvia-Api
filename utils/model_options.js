"use strict";

/** Shared Sequelize define() options: soft-deleted via archived_at. */
function archivable(tableName) {
  return {
    tableName,
    paranoid: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "archived_at",
    underscored: true,
  };
}

const id = (DataTypes) => ({ allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER });

/** Integer foreign-key attribute mapped to a snake_case column. */
function ref(DataTypes, field, allowNull = false) {
  return { type: DataTypes.INTEGER, allowNull, field };
}

module.exports = { archivable, id, ref };
