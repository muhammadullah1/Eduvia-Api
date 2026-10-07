"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
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
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      gender: {
        type: Sequelize.ENUM("Male", "Female", "Other"),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM("super_admin", "operations_manager", "accountant", "teacher", "parent"),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "pending", "blocked"),
        allowNull: false,
        defaultValue: "active",
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      photo: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      archived_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("users", ["fk_school_id", "email"], {
      unique: true,
      name: "idx_users_school_email_unique",
    });

    await queryInterface.addIndex("users", ["fk_school_id", "role"], {
      name: "idx_users_school_role",
    });

    await queryInterface.addIndex("users", ["email"], {
      name: "idx_users_email",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_status";');
  },
};
