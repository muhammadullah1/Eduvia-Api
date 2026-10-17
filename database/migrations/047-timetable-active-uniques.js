"use strict";

/** Active timetable rows only. Archived slots must not block a new period. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_timetable_class_day_period_unique",
    );
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_timetable_teacher_day_period_unique",
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_timetable_class_day_period_unique
      ON timetable_slots (fk_class_id, day_of_week, period_index)
      WHERE archived_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_timetable_teacher_day_period_unique
      ON timetable_slots (fk_school_id, fk_teacher_id, day_of_week, period_index)
      WHERE archived_at IS NULL AND fk_teacher_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_timetable_class_day_period_unique",
    );
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS idx_timetable_teacher_day_period_unique",
    );
    await queryInterface.addIndex(
      "timetable_slots",
      ["fk_class_id", "day_of_week", "period_index"],
      { unique: true, name: "idx_timetable_class_day_period_unique" },
    );
    await queryInterface.addIndex(
      "timetable_slots",
      ["fk_school_id", "fk_teacher_id", "day_of_week", "period_index"],
      { unique: true, name: "idx_timetable_teacher_day_period_unique" },
    );
  },
};
