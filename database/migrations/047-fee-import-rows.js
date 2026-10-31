"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("fee_import_rows", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_batch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "fee_import_batches", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      row_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      admission_no: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      month: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      reference_no: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      payment_method: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      errors: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      raw: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      fk_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "fee_payments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
    });

    await queryInterface.addIndex(
      "fee_import_rows",
      ["fk_batch_id", "row_number"],
      { name: "uq_fee_import_rows_batch_row", unique: true },
    );
    await queryInterface.addConstraint("fee_import_rows", {
      fields: ["amount"],
      type: "check",
      name: "fee_import_rows_amount_check",
      where: { [Op.or]: [{ amount: null }, { amount: { [Op.gte]: 0 } }] },
    });
    await queryInterface.addConstraint("fee_import_rows", {
      fields: ["status"],
      type: "check",
      name: "fee_import_rows_status_check",
      where: { status: ["Valid", "Error", "Duplicate", "Imported", "Skipped"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_import_rows");
  },
};
