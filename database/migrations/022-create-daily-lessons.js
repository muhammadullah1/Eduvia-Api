"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("daily_lessons", {
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_chapter_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "planned_chapters", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      topic: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      homework: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notes: {
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
      classwork: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      review_status: {
        type: Sequelize.ENUM("Submitted", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Submitted",
      },
      fk_submitted_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_reviewed_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      review_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "daily_lessons",
      ["fk_class_id", "fk_subject_id", "date"],
      { name: "idx_daily_lessons_class_subject_date" },
    );
    await queryInterface.addIndex("daily_lessons", ["fk_school_id", "date"], {
      name: "idx_daily_lessons_school_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("daily_lessons");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_daily_lessons_review_status";',
    );
  },
};
