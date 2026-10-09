"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("fee_payments", {
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
      receipt_no: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      amount_paid: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      unallocated_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      payment_method: {
        type: Sequelize.ENUM("Cash", "BankTransfer", "Cheque", "Online"),
        allowNull: false,
        defaultValue: "Cash",
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      reference_no: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      idempotency_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      fk_recorded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
    });

    await queryInterface.addIndex("fee_payments", ["fk_school_id", "receipt_no"], {
      unique: true,
      name: "idx_fee_payments_school_receipt_no_unique",
    });

    await queryInterface.addIndex("fee_payments", ["idempotency_key"], {
      unique: true,
      name: "idx_fee_payments_idempotency_key_unique",
      where: {
        idempotency_key: {
          [Sequelize.Op.ne]: null,
        },
      },
    });

    await queryInterface.addIndex("fee_payments", ["fk_student_id", "payment_date"], {
      name: "idx_fee_payments_student_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("fee_payments");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fee_payments_payment_method";');
  },
};
