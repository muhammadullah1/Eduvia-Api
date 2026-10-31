"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("families", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      display_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      fk_primary_parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "parents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fk_verified_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("families", ["fk_school_id"], {
      name: "idx_families_school",
      where: { archived_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("families");
  },
};
