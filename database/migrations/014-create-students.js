"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("students", {
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "classes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      admission_no: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      gender: {
        type: Sequelize.ENUM("Male", "Female", "Other"),
        allowNull: false,
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      blood_group: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      admission_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("Active", "Inactive", "Graduated", "StruckOff", "Withdrawn"),
        allowNull: false,
        defaultValue: "Active",
      },
      discount_percent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      fixed_monthly_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      photo: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      emergency_contact: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      address: {
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

    await queryInterface.addIndex("students", ["fk_school_id", "admission_no"], {
      unique: true,
      name: "idx_students_school_admission_no_unique",
    });

    await queryInterface.addIndex("students", ["fk_school_id", "fk_class_id", "status"], {
      name: "idx_students_school_class_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("students");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_students_status";');
  },
};
