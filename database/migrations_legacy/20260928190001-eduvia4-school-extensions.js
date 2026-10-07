"use strict";

/**
 * EDUVIA-4 schema extensions:
 * - roles: accountant, controller
 * - classes.period_count (variable 7/8/9…)
 * - teachers.fk_primary_subject_id (1:1 editable primary subject; join retained)
 * - timetable_slots.period_index + fk_subject_id
 * - mark_sheets.fee_period + row fee-gate / override columns
 * - teacher_absences, daily_lessons, daily_tests/results, monthly_tests/results
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Expand users.role enum safely via temporary string column
    await queryInterface.changeColumn("users", "role", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.changeColumn("users", "role", {
      type: Sequelize.ENUM(
        "management",
        "controller",
        "accountant",
        "teacher",
        "parent",
      ),
      allowNull: false,
    });

    await queryInterface.addColumn("classes", "period_count", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 8,
    });

    await queryInterface.addColumn("teachers", "fk_primary_subject_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "subjects", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("timetable_slots", "period_index", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn("timetable_slots", "fk_subject_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "subjects", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("mark_sheets", "fee_period", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("mark_sheets", "pass_percent", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 40,
    });

    await queryInterface.addColumn("mark_sheet_rows", "blocked_by_fee", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("mark_sheet_rows", "manual_override", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("mark_sheet_rows", "override_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("mark_sheet_rows", "override_by_user_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("mark_sheet_rows", "visible_to_parent", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("fee_payments", "due_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn("fee_payments", "notes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.createTable("teacher_absences", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
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
      fk_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "classes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fk_timetable_slot_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "timetable_slots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      period_index: { type: Sequelize.INTEGER, allowNull: false },
      status: {
        type: Sequelize.ENUM("Absent", "Covered", "Cancelled", "Unmanaged"),
        allowNull: false,
        defaultValue: "Absent",
      },
      fk_cover_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex(
      "teacher_absences",
      ["fk_teacher_id", "date", "period_index", "fk_class_id"],
      { unique: true, name: "teacher_absences_unique_period" },
    );

    await queryInterface.createTable("daily_lessons", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
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
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      period_index: { type: Sequelize.INTEGER, allowNull: true },
      chapter: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      progress: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM("Planned", "In progress", "Completed"),
        allowNull: false,
        defaultValue: "Planned",
      },
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("daily_lessons", ["fk_class_id", "date", "fk_subject_id"], {
      name: "daily_lessons_class_date_subject",
    });

    await queryInterface.createTable("daily_tests", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
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
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      period_index: { type: Sequelize.INTEGER, allowNull: true },
      title: { type: Sequelize.STRING, allowNull: false },
      max_score: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 20 },
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable("daily_test_results", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_daily_test_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "daily_tests", key: "id" },
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
      score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("daily_test_results", ["fk_daily_test_id", "fk_student_id"], {
      unique: true,
      name: "daily_test_results_unique",
    });

    await queryInterface.createTable("monthly_tests", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      month: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      max_score: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 100 },
      pass_percent: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 40 },
      test_date: { type: Sequelize.DATEONLY, allowNull: true },
      archived_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("monthly_tests", ["fk_class_id", "fk_subject_id", "month", "title"], {
      name: "monthly_tests_lookup",
    });

    await queryInterface.createTable("monthly_test_results", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      fk_monthly_test_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "monthly_tests", key: "id" },
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
      score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      passed: { type: Sequelize.BOOLEAN, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("monthly_test_results", ["fk_monthly_test_id", "fk_student_id"], {
      unique: true,
      name: "monthly_test_results_unique",
    });

    await queryInterface.createTable("monthly_student_summaries", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
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
        allowNull: true,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      fk_student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "students", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      month: { type: Sequelize.STRING, allowNull: false },
      tests_taken: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      passed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      failed_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      average_percent: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      status: {
        type: Sequelize.ENUM("InProgress", "Passed", "LowMarks", "Failed"),
        allowNull: false,
        defaultValue: "InProgress",
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex(
      "monthly_student_summaries",
      ["fk_student_id", "fk_class_id", "fk_subject_id", "month"],
      { unique: true, name: "monthly_student_summaries_unique" },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("monthly_student_summaries");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_monthly_student_summaries_status";');
    await queryInterface.dropTable("monthly_test_results");
    await queryInterface.dropTable("monthly_tests");
    await queryInterface.dropTable("daily_test_results");
    await queryInterface.dropTable("daily_tests");
    await queryInterface.dropTable("daily_lessons");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_daily_lessons_status";');
    await queryInterface.dropTable("teacher_absences");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teacher_absences_status";');

    await queryInterface.removeColumn("fee_payments", "notes");
    await queryInterface.removeColumn("fee_payments", "due_date");
    await queryInterface.removeColumn("mark_sheet_rows", "visible_to_parent");
    await queryInterface.removeColumn("mark_sheet_rows", "override_by_user_id");
    await queryInterface.removeColumn("mark_sheet_rows", "override_reason");
    await queryInterface.removeColumn("mark_sheet_rows", "manual_override");
    await queryInterface.removeColumn("mark_sheet_rows", "blocked_by_fee");
    await queryInterface.removeColumn("mark_sheets", "pass_percent");
    await queryInterface.removeColumn("mark_sheets", "fee_period");
    await queryInterface.removeColumn("timetable_slots", "fk_subject_id");
    await queryInterface.removeColumn("timetable_slots", "period_index");
    await queryInterface.removeColumn("teachers", "fk_primary_subject_id");
    await queryInterface.removeColumn("classes", "period_count");

    await queryInterface.changeColumn("users", "role", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.changeColumn("users", "role", {
      type: Sequelize.ENUM("management", "teacher", "parent"),
      allowNull: false,
    });
  },
};
