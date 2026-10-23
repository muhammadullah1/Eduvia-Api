"use strict";

/** Rotating refresh tokens (stored as SHA-256 hashes, grouped in families for reuse detection). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refresh_tokens", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      family_id: { type: Sequelize.UUID, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      replaced_by_id: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("refresh_tokens", ["family_id"]);
    await queryInterface.addIndex("refresh_tokens", ["fk_user_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refresh_tokens");
  },
};
