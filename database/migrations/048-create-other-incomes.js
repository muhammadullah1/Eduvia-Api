"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("other_incomes", {
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
      income_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      payment_method: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Cash",
      },
      reference_no: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      received_from: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fk_recorded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
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
      archived_at: {
        type: Sequelize.DATE,
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
    });

    await queryInterface.addIndex(
      "other_incomes",
      ["fk_school_id", "category_key"],
      { name: "idx_other_incomes_school_category" },
    );
    await queryInterface.addIndex(
      "other_incomes",
      ["fk_school_id", "income_date"],
      { name: "idx_other_incomes_school_date" },
    );
    await queryInterface.addConstraint("other_incomes", {
      fields: ["amount"],
      type: "check",
      name: "other_incomes_amount_check",
      where: { amount: { [Op.gt]: 0 } },
    });
    await queryInterface.addConstraint("other_incomes", {
      fields: ["category_key"],
      type: "check",
      name: "other_incomes_category_key_check",
      where: { category_key: ["Donation", "Grant", "Misc"] },
    });
    await queryInterface.addConstraint("other_incomes", {
      fields: ["payment_method"],
      type: "check",
      name: "other_incomes_payment_method_check",
      where: { payment_method: ["Cash", "BankTransfer", "Cheque", "Online"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("other_incomes");
  },
};
