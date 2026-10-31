"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("roles", {
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
      key: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      portal: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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

    await queryInterface.addIndex("roles", ["fk_school_id", "key"], {
      name: "uq_roles_school_key",
      unique: true,
    });
    await queryInterface.addConstraint("roles", {
      fields: ["portal"],
      type: "check",
      name: "roles_portal_check",
      where: { portal: ["admin", "teacher", "parent"] },
    });
    await queryInterface.addConstraint("roles", {
      fields: ["version"],
      type: "check",
      name: "roles_version_check",
      where: { version: { [Op.gte]: 1 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("roles");
  },
};
