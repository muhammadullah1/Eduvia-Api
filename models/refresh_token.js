"use strict";

module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    "refresh_tokens",
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      fkUserId: { type: DataTypes.INTEGER, allowNull: false, field: "fk_user_id" },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, field: "token_hash" },
      familyId: { type: DataTypes.UUID, allowNull: false, field: "family_id" },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
      revokedAt: { type: DataTypes.DATE, allowNull: true, field: "revoked_at" },
      replacedById: { type: DataTypes.INTEGER, allowNull: true, field: "replaced_by_id" },
      graceUsedAt: { type: DataTypes.DATE, allowNull: true, field: "grace_used_at" },
    },
    { timestamps: true, underscored: true },
  );
  return RefreshToken;
};
