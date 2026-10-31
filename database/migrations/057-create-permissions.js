"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("permissions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      module: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      risk: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      assignable_roles: {
        type: Sequelize.ARRAY(Sequelize.STRING(40)),
        allowNull: false,
        defaultValue: [],
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

    await queryInterface.addIndex("permissions", ["module"], {
      name: "idx_permissions_module",
    });
    await queryInterface.addConstraint("permissions", {
      fields: ["risk"],
      type: "check",
      name: "permissions_risk_check",
      where: { risk: ["low", "medium", "high"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("permissions");
  },
};
