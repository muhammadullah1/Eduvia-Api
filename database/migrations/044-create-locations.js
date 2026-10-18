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
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      location_code: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      location_type: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      CREATE UNIQUE INDEX idx_locations_session_name_active_unique
      ON locations (fk_school_id, fk_session_id, lower(name))
      WHERE archived_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_locations_session_code_active_unique
      ON locations (fk_school_id, fk_session_id, lower(location_code))
      WHERE archived_at IS NULL AND location_code IS NOT NULL AND btrim(location_code) <> ''
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_session_code_active_unique",
    );
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_locations_session_name_active_unique",
    );
    await queryInterface.dropTable("locations");
  },
};
