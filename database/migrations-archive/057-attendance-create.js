"use strict";

/**
 * Management can create a missing attendance mark (EDUVIA-14 decision 3).
 * - attendances.fk_created_by_user_id: who created the record (created_at already exists).
 * - attendance_changes.from_status becomes nullable: a creation has no previous status
 *   and is logged with source "created".
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "attendances",
        "fk_created_by_user_id",
        { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
        { transaction },
      );
      await queryInterface.changeColumn("attendance_changes", "from_status", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("attendance_changes", { from_status: null }, { transaction });
      await queryInterface.changeColumn("attendance_changes", "from_status", { type: Sequelize.STRING(20), allowNull: false }, { transaction });
      await queryInterface.removeColumn("attendances", "fk_created_by_user_id", { transaction });
    });
  },
};
