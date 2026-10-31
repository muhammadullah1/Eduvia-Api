"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("expenses", {
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
        onDelete: "RESTRICT",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      expense_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fk_recorded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      receipt_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      notes: {
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
      payment_method: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      category_key: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      archive_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fk_archived_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reference_no: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "expenses",
      ["fk_school_id", "category_key"],
      { name: "idx_expenses_school_category" },
    );
    await queryInterface.addIndex(
      "expenses",
      ["fk_school_id", "expense_date"],
      { name: "idx_expenses_school_date" },
    );
    await queryInterface.addConstraint("expenses", {
      fields: ["category_key"],
      type: "check",
      name: "expenses_category_key_check",
      where: {
        category_key: [
          "StaffSalary",
          "Utilities",
          "Supplies",
          "Maintenance",
          "Other",
        ],
      },
    });
    await queryInterface.addConstraint("expenses", {
      fields: ["payment_method"],
      type: "check",
      name: "expenses_payment_method_check",
      where: {
        [Op.or]: [
          { payment_method: null },
          { payment_method: ["Cash", "BankTransfer", "Cheque", "Online"] },
        ],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("expenses");
  },
};
