"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_fee_months", {
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
      fee_type: {
        type: Sequelize.ENUM("Tuition", "Admission", "Exam", "Annual", "Transport", "Other"),
        allowNull: false,
        defaultValue: "Tuition",
      },
      base_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      discount_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      net_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      paid_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      status: {
        type: Sequelize.ENUM("Unpaid", "Partial", "Paid"),
        allowNull: false,
        defaultValue: "Unpaid",
      },
      due_date: {
        type: Sequelize.DATEONLY,
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

    await queryInterface.addIndex("student_fee_months", ["fk_student_id", "month", "fee_type"], {
      unique: true,
      name: "idx_fee_months_student_month_type_unique",
    });

    await queryInterface.addIndex("student_fee_months", ["fk_school_id", "month", "status"], {
      name: "idx_fee_months_school_month_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_fee_months");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_fee_months_fee_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_fee_months_status";');
  },
};
