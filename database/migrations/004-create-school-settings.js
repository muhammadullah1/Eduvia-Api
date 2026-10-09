"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("school_settings", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "schools",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      admission_number_prefix: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: "CLS",
      },
      admission_number_digits: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 4,
      },
      academic_year_start_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 4,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: "PKR",
      },
      tuition_fee_due_day: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 10,
      },
      late_fee_fine_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      late_fee_grace_days: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5,
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: "Asia/Karachi",
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

    await queryInterface.addIndex("school_settings", ["fk_school_id"], {
      unique: true,
      name: "idx_school_settings_school_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("school_settings");
  },
};
