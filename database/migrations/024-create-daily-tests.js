"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("daily_tests", {
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
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      total_marks: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 20,
      },
      title: {
        type: Sequelize.STRING(255),
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
      fk_schedule_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "daily_test_schedules", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      month: {
        type: Sequelize.STRING(7),
        allowNull: false,
      },
      week_of_month: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fk_published_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      status: {
        type: Sequelize.ENUM("Scheduled", "MarksEntered", "Published"),
        allowNull: false,
        defaultValue: "Scheduled",
      },
    });

    await queryInterface.addIndex(
      "daily_tests",
      ["fk_class_id", "fk_subject_id", "date"],
      {
        name: "daily_tests_class_subject_date",
        unique: true,
        where: { archived_at: null },
      },
    );
    await queryInterface.addIndex(
      "daily_tests",
      ["fk_class_id", "fk_subject_id", "date"],
      { name: "idx_daily_tests_class_subject_date_unique", unique: true },
    );
    await queryInterface.addIndex("daily_tests", ["fk_school_id", "date"], {
      name: "idx_daily_tests_school_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("daily_tests");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_daily_tests_status";',
    );
  },
};
