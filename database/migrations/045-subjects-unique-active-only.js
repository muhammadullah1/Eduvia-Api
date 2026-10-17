"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex(
      "subjects",
      "idx_subjects_school_name_unique",
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_subjects_school_name_active_unique
      ON subjects (fk_school_id, lower(name))
      WHERE archived_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_subjects_school_name_active_unique",
    );
    await queryInterface.addIndex("subjects", ["fk_school_id", "name"], {
      unique: true,
      name: "idx_subjects_school_name_unique",
    });
  },
};
