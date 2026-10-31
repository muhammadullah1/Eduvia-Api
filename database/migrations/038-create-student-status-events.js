"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("student_status_events", {
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
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      effective_on: {
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      final_result: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      academic_status: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      financial_status: {
        type: Sequelize.STRING(255),
        allowNull: true,
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
      event_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      reason_category: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      fk_to_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onDelete: "SET NULL",
      },
      outstanding_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      transfer_to_school: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      graduation_override: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });

    await queryInterface.addIndex(
      "student_status_events",
      ["fk_school_id", "effective_on"],
      { name: "idx_status_events_school_date" },
    );
    await queryInterface.addIndex("student_status_events", ["fk_student_id"], {
      name: "idx_status_events_student",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("student_status_events");
  },
};
