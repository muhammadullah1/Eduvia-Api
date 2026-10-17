"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("locations", {
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
      name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      room_name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      room_code: {
        type: Sequelize.STRING(40),
        allowNull: true
      },
      selection_type: {
        type: Sequelize.ENUM("home", "away"),
        allowNull: false,
        defaultValue: "home",
      },
      location_type: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
      archived_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_locations_school_room_active_unique
      ON locations (fk_school_id, lower(room_name))
      WHERE archived_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_school_room_active_unique",
    );
    await queryInterface.dropTable("locations");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_locations_selection_type";',
    );
  },
};
