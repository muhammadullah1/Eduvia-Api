"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("substitute_assignments", {
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
      fk_absence_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "teacher_absences", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_timetable_slot_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "timetable_slots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_substitute_teacher_id: {
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
      period_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("Assigned", "Completed", "Cancelled"),
        allowNull: false,
        defaultValue: "Assigned",
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
      fk_original_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_authorized_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "substitute_assignments",
      ["fk_school_id", "date"],
      { name: "idx_substitute_assignments_school_date" },
    );
    await queryInterface.addIndex(
      "substitute_assignments",
      ["fk_substitute_teacher_id", "date", "period_index"],
      {
        name: "idx_substitute_teacher_date_period_unique",
        unique: true,
        where: { archived_at: null },
      },
    );
    await queryInterface.addIndex("substitute_assignments", ["fk_absence_id"], {
      name: "substitute_assignments_one_per_absence",
      unique: true,
      where: { archived_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("substitute_assignments");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_substitute_assignments_status";',
    );
  },
};
