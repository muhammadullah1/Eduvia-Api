"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("student_fee_concessions", {
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
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_family_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "families", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      category: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Standard",
      },
      mode: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      value: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      stackable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      max_discount_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      effective_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      effective_to: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Draft",
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      fee_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Tuition",
      },
      fk_reason_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "school_concession_reasons", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_replaces_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "student_fee_concessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    });

    await queryInterface.addIndex(
      "student_fee_concessions",
      ["fk_school_id", "status"],
      { name: "idx_concessions_school_status" },
    );
    await queryInterface.addIndex(
      "student_fee_concessions",
      ["fk_student_id", "fk_session_id", "status"],
      { name: "idx_concessions_student_session", where: { archived_at: null } },
    );
    await queryInterface.addIndex(
      "student_fee_concessions",
      ["fk_school_id", "fk_student_id", "fee_type"],
      {
        name: "uq_concession_one_approved_per_student_type",
        unique: true,
        where: { status: "Approved", archived_at: null },
      },
    );
    await queryInterface.addConstraint("student_fee_concessions", {
      fields: ["category"],
      type: "check",
      name: "student_fee_concessions_category_check",
      where: { category: ["Standard", "Scholarship", "Sibling", "Other"] },
    });
    await queryInterface.addConstraint("student_fee_concessions", {
      fields: ["fee_type"],
      type: "check",
      name: "student_fee_concessions_fee_type_check",
      where: {
        fee_type: ["Tuition", "Admission", "Exam", "Annual", "Promotion"],
      },
    });
    await queryInterface.addConstraint("student_fee_concessions", {
      fields: ["mode"],
      type: "check",
      name: "student_fee_concessions_mode_check",
      where: { mode: ["percent", "fixed_discount", "fixed_payable", "waiver"] },
    });
    await queryInterface.addConstraint("student_fee_concessions", {
      fields: ["status"],
      type: "check",
      name: "student_fee_concessions_status_check",
      where: {
        status: [
          "Draft",
          "PendingApproval",
          "Approved",
          "Rejected",
          "Revoked",
          "Superseded",
        ],
      },
    });
    await queryInterface.addConstraint("student_fee_concessions", {
      fields: ["value"],
      type: "check",
      name: "student_fee_concessions_value_check",
      where: { value: { [Op.gte]: 0 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_concessions");
  },
};
