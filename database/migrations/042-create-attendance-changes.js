"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("attendance_changes", {
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
        onDelete: "CASCADE",
      },
      fk_attendance_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "attendances", key: "id" },
        onDelete: "SET NULL",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onDelete: "CASCADE",
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onDelete: "SET NULL",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "review",
      },
      fk_actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
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
    });

    await queryInterface.addIndex("attendance_changes", [
      "fk_school_id",
      "created_at",
    ]);
    await queryInterface.addIndex("attendance_changes", [
      "fk_student_id",
      "date",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("attendance_changes");
  },
};
