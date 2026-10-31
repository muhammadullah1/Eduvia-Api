"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("block_dates", {
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
        allowNull: false,
      },
      date_type: {
        type: Sequelize.ENUM("single", "multiple"),
        allowNull: false,
        defaultValue: "single",
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex("block_dates", ["start_date", "end_date"], {
      name: "idx_block_dates_range",
    });
    await queryInterface.addIndex("block_dates", ["fk_school_id"], {
      name: "idx_block_dates_school",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("block_dates");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_block_dates_date_type";',
    );
  },
};
