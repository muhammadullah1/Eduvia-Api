"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("student_fee_month_adjustments", {
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
      fk_fee_month_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "student_fee_months", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      delta_collectible: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "PendingApproval",
      },
      fk_requested_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_approved_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      rejection_reason: {
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
    });

    await queryInterface.addIndex(
      "student_fee_month_adjustments",
      ["fk_fee_month_id", "status"],
      { name: "idx_fee_month_adjustments_month" },
    );
    await queryInterface.addConstraint("student_fee_month_adjustments", {
      fields: ["delta_collectible"],
      type: "check",
      name: "student_fee_month_adjustments_delta_check",
      where: { delta_collectible: { [Op.ne]: 0 } },
    });
    await queryInterface.addConstraint("student_fee_month_adjustments", {
      fields: ["status"],
      type: "check",
      name: "student_fee_month_adjustments_status_check",
      where: {
        status: ["Draft", "PendingApproval", "Approved", "Rejected", "Voided"],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_month_adjustments");
  },
};
