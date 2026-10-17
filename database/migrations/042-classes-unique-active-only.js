"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex(
      "classes",
      "idx_classes_school_session_grade_section_unique",
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_classes_school_session_grade_section_active_unique
      ON classes (fk_school_id, fk_session_id, grade, section)
      WHERE archived_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_classes_school_session_grade_section_active_unique
    `);
    await queryInterface.addIndex(
      "classes",
      ["fk_school_id", "fk_session_id", "grade", "section"],
      {
        unique: true,
        name: "idx_classes_school_session_grade_section_unique",
      },
    );
  },
};
