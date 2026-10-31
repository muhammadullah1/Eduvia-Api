"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("school_permission_versions", {
      fk_school_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      version: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 1,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("school_permission_versions", {
      fields: ["version"],
      type: "check",
      name: "school_permission_versions_version_check",
      where: { version: { [Op.gte]: 1 } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("school_permission_versions");
  },
};
