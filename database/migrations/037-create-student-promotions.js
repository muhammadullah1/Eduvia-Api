"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_promotions", {
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
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_from_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_to_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      promoted_on: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fk_actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("now"),
      },
      outcome: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Promoted",
      },
    });

    await queryInterface.addIndex(
      "student_promotions",
      ["fk_school_id", "promoted_on"],
      { name: "idx_student_promotions_school_date" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_promotions");
  },
};
