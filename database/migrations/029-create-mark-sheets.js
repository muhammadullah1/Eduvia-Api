"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.createTable("mark_sheets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      fk_exam_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "exams", key: "id" },
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
      fk_subject_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "subjects", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      total_marks: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 100,
      },
      passing_marks: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 40,
      },
      status: {
        type: Sequelize.ENUM("Draft", "Submitted", "Verified", "Published"),
        allowNull: false,
        defaultValue: "Draft",
      },
      fk_submitted_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
      fk_school_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "schools", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fk_teacher_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "teachers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
      paper_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      start_time: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      end_time: {
        type: Sequelize.TIME,
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "mark_sheets",
      ["fk_class_id", "fk_subject_id"],
      { name: "idx_mark_sheets_class_subject" },
    );
    await queryInterface.addIndex(
      "mark_sheets",
      ["fk_exam_id", "fk_class_id", "fk_subject_id"],
      { name: "idx_mark_sheets_exam_class_subject_unique", unique: true },
    );
    await queryInterface.addConstraint("mark_sheets", {
      fields: ["total_marks", "passing_marks"],
      type: "check",
      name: "chk_mark_sheets_paper_marks",
      where: {
        [Op.and]: [
          { total_marks: { [Op.gt]: 0 } },
          { passing_marks: { [Op.gte]: 0 } },
          { passing_marks: { [Op.lte]: Sequelize.col("total_marks") } },
        ],
      },
    });
    await queryInterface.addConstraint("mark_sheets", {
      fields: ["start_time", "end_time"],
      type: "check",
      name: "chk_mark_sheets_paper_time",
      where: {
        [Op.or]: [
          { start_time: null },
          { end_time: null },
          { end_time: { [Op.gt]: Sequelize.col("start_time") } },
        ],
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mark_sheets");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_mark_sheets_status";',
    );
  },
};
