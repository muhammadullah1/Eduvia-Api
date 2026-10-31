"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("student_credit_ledger", {
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
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      entry_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "payment",
      },
      fk_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "fee_payments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_fee_month_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "student_fee_months", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fk_created_by_user_id: {
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
    });

    await queryInterface.addIndex(
      "student_credit_ledger",
      ["fk_school_id", "fk_student_id"],
      { name: "idx_credit_ledger_student" },
    );
    await queryInterface.addIndex("student_credit_ledger", ["fk_payment_id"], {
      name: "uq_credit_ledger_backfill_payment",
      unique: true,
      where: { source: "backfill" },
    });
    await queryInterface.addConstraint("student_credit_ledger", {
      fields: ["amount"],
      type: "check",
      name: "student_credit_ledger_amount_check",
      where: { amount: { [Op.gt]: 0 } },
    });
    await queryInterface.addConstraint("student_credit_ledger", {
      fields: ["entry_type"],
      type: "check",
      name: "student_credit_ledger_entry_type_check",
      where: { entry_type: ["Credit", "Applied", "Reversal"] },
    });
    await queryInterface.addConstraint("student_credit_ledger", {
      fields: ["source"],
      type: "check",
      name: "student_credit_ledger_source_check",
      where: { source: ["payment", "backfill", "import", "manual"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_credit_ledger");
  },
};
