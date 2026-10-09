"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
        references: {
          model: "schools",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "students",
          key: "id",
        },
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
    });

    await queryInterface.addIndex("monthly_student_summaries", ["fk_student_id", "month"], {
      unique: true,
      name: "idx_monthly_summaries_student_month_unique",
    });

    await queryInterface.addIndex("monthly_student_summaries", ["fk_school_id", "month"], {
      name: "idx_monthly_summaries_school_month",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monthly_student_summaries");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_monthly_student_summaries_fee_status";');
  },
};
