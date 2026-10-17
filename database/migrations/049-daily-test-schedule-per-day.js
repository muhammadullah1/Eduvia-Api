"use strict";

/** One subject may have a test on more than one weekday for the same class. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_daily_test_schedules_class_subject_active"
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_daily_test_schedules_class_subject_day_active
      ON daily_test_schedules (fk_class_id, fk_subject_id, day_of_week)
      WHERE archived_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_daily_test_schedules_class_subject_day_active"
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_daily_test_schedules_class_subject_active
      ON daily_test_schedules (fk_class_id, fk_subject_id)
      WHERE archived_at IS NULL
    `);
  },
};
