"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      actor_label: { type: Sequelize.STRING, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: false },
      at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
  },
};
