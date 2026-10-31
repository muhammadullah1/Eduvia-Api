"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("classes", {
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
      fk_session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "academic_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      grade: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      section: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      room: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      period_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 8,
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 50,
      },
      status: {
        type: Sequelize.ENUM("Active", "Archived", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      period_start_times: {
        type: Sequelize.JSONB,
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
      fk_super_master_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    });

    await queryInterface.addIndex("classes", ["fk_super_master_teacher_id"], {
      name: "classes_super_master_idx",
    });
    await queryInterface.addIndex(
      "classes",
      ["fk_school_id", "fk_session_id"],
      { name: "idx_classes_school_session" },
    );
    await queryInterface.addIndex(
      "classes",
      ["fk_school_id", "fk_session_id", "grade", "section"],
      {
        name: "idx_classes_school_session_grade_section_active_unique",
        unique: true,
        where: { archived_at: null },
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("classes");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_classes_status";',
    );
  },
};
