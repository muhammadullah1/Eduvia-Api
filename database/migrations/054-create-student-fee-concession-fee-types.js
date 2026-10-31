"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_fee_concession_fee_types", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_concession_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "student_fee_concessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fee_type: {
        type: Sequelize.STRING(20),
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

    await queryInterface.addIndex(
      "student_fee_concession_fee_types",
      ["fk_concession_id", "fee_type"],
      { name: "uq_concession_fee_types", unique: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_concession_fee_types");
  },
};
