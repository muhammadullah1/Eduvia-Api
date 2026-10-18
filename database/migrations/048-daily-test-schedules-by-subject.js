"use strict";

/** A class keeps one test day per subject. Several subjects may share a weekday. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("daily_test_schedules", "total_marks", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 20,
    });
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_daily_test_schedules_class_day_unique"
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_daily_test_schedules_class_subject_active
      ON daily_test_schedules (fk_class_id, fk_subject_id)
      WHERE archived_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_daily_test_schedules_class_subject_active"
    );
    await queryInterface.addIndex(
      "daily_test_schedules",
      ["fk_class_id", "day_of_week"],
      { unique: true, name: "idx_daily_test_schedules_class_day_unique" }
    );
    await queryInterface.removeColumn("daily_test_schedules", "total_marks");
  },
};
