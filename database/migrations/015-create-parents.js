"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("parents", {
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
      father_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      mother_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      primary_contact_number: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      occupation: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      cnic: {
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

    await queryInterface.addIndex("parents", ["fk_user_id"], {
      unique: true,
      name: "idx_parents_user_unique",
    });

    await queryInterface.addIndex("parents", ["fk_school_id", "cnic"], {
      name: "idx_parents_school_cnic",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("parents");
  },
};
