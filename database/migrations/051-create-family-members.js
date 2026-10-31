"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("family_members", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_family_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "families", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Active",
      },
      linked_via: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "manual",
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

    await queryInterface.addIndex("family_members", ["fk_student_id"], {
      name: "uq_family_members_active_student",
      unique: true,
      where: { status: "Active" },
    });
    await queryInterface.addIndex(
      "family_members",
      ["fk_family_id", "fk_student_id"],
      { name: "uq_family_members_family_student", unique: true },
    );
    await queryInterface.addConstraint("family_members", {
      fields: ["linked_via"],
      type: "check",
      name: "family_members_linked_via_check",
      where: { linked_via: ["manual", "shared_parent_suggestion"] },
    });
    await queryInterface.addConstraint("family_members", {
      fields: ["status"],
      type: "check",
      name: "family_members_status_check",
      where: { status: ["Active", "Removed"] },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("family_members");
  },
};
