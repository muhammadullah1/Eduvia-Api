"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("fee_allocations", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "fee_payments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_fee_month_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "student_fee_months",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      allocated_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
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
    });

    await queryInterface.addIndex("fee_allocations", ["fk_payment_id", "fk_fee_month_id"], {
      unique: true,
      name: "idx_fee_allocations_payment_fee_month_unique",
    });

    await queryInterface.addIndex("fee_allocations", ["fk_fee_month_id"], {
      name: "idx_fee_allocations_fee_month",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_allocations");
  },
};
