"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("teacher_absences", {
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
        onDelete: "RESTRICT",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("Pending", "Covered", "Cancelled", "NoClass"),
        allowNull: false,
        defaultValue: "Pending",
      },
      fk_approved_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
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
      period_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_timetable_slot_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "timetable_slots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_marked_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    });

    await queryInterface.addIndex(
      "teacher_absences",
      ["fk_school_id", "date"],
      { name: "idx_teacher_absences_school_date" },
    );
    await queryInterface.addIndex(
      "teacher_absences",
      ["fk_teacher_id", "date", "period_index"],
      {
        name: "teacher_absences_teacher_period",
        unique: true,
        where: { archived_at: null },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("teacher_absences");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_teacher_absences_status";',
    );
  },
};
