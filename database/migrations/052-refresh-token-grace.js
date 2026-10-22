"use strict";

/** Marks when a just-rotated refresh token used its one concurrent-refresh grace. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("refresh_tokens", "grace_used_at", { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("refresh_tokens", "grace_used_at");
  },
};
