"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("monthly_student_summaries", {
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
      month: {
        type: Sequelize.STRING(7),
        allowNull: false,
      },
      attendance_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      daily_test_percentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      fee_status: {
        type: Sequelize.ENUM("Paid", "Partial", "Unpaid"),
        allowNull: true,
      },
      teacher_remarks: {
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tests_scheduled: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tests_taken: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      passed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      flagged_for_follow_up: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await queryInterface.addIndex(
      "monthly_student_summaries",
      ["fk_school_id", "month"],
      { name: "idx_monthly_summaries_school_month" },
    );
    await queryInterface.addIndex(
      "monthly_student_summaries",
      ["fk_student_id", "month"],
      { name: "idx_monthly_summaries_student_month_unique", unique: true },
    );
    await queryInterface.addIndex(
      "monthly_student_summaries",
      ["fk_student_id", "fk_class_id", "fk_subject_id", "month"],
      {
        name: "monthly_student_summaries_subject_month",
        unique: true,
        where: {
          fk_class_id: { [Op.ne]: null },
          fk_subject_id: { [Op.ne]: null },
          archived_at: null,
        },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monthly_student_summaries");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_monthly_student_summaries_fee_status";',
    );
  },
};
