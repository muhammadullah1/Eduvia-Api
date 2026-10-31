"use strict";

/**
 * Fee structure is the only source of class tuition. `classes.monthly_tuition_fee` was a
 * mirror of the Tuition row in force; drop it. Down re-adds it and backfills from the live
 * Tuition row in force today (or on the session's first day for a session not yet started).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("classes", "monthly_tuition_fee");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "classes",
        "monthly_tuition_fee",
        { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE classes c SET monthly_tuition_fee = COALESCE((
           SELECT f.amount FROM fee_structures f, academic_sessions s
            WHERE s.id = c.fk_session_id AND f.fk_class_id = c.id AND f.fee_type = 'Tuition'
              AND f.archived_at IS NULL AND f.effective_from <= GREATEST(CURRENT_DATE, s.start_date)
            ORDER BY f.effective_from DESC, f.id DESC LIMIT 1
         ), 0)`,
        { transaction },
      );
    });
  },
};
