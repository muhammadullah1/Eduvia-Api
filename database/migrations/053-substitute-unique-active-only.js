"use strict";

/**
 * Released substitute assignments are soft-deleted, but the substitute's
 * (teacher, date, period) unique index still counted them, so a teacher whose
 * cover was released could never be booked for that period again. Only live
 * rows count now, and released rows carry status Cancelled.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE substitute_assignments SET status = 'Cancelled'
      WHERE archived_at IS NOT NULL AND status = 'Assigned'`);
    await queryInterface.removeIndex("substitute_assignments", "idx_substitute_teacher_date_period_unique");
    await queryInterface.addIndex("substitute_assignments", ["fk_substitute_teacher_id", "date", "period_index"], {
      name: "idx_substitute_teacher_date_period_unique",
      unique: true,
      where: { archived_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("substitute_assignments", "idx_substitute_teacher_date_period_unique");
    await queryInterface.addIndex("substitute_assignments", ["fk_substitute_teacher_id", "date", "period_index"], {
      name: "idx_substitute_teacher_date_period_unique",
      unique: true,
    });
  },
};
