"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("teachers", {
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
      fk_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "subjects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      employee_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      qualification: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      joining_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("Active", "OnLeave", "Resigned", "Terminated"),
        allowNull: false,
        defaultValue: "Active",
      },
      monthly_salary: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.addIndex("teachers", ["fk_school_id", "employee_code"], {
      unique: true,
      name: "idx_teachers_school_employee_code_unique",
    });

    await queryInterface.addIndex("teachers", ["fk_user_id"], {
      unique: true,
      name: "idx_teachers_user_unique",
    });

    await queryInterface.addIndex("teachers", ["fk_school_id", "status"], {
      name: "idx_teachers_school_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("teachers");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teachers_status";');
  },
};
