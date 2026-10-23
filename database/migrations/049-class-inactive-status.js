"use strict";

/**
 * Classes gain an "Inactive" status: a class is only Active while it has
 * enrolled students. Existing Active classes without any are set Inactive.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_classes_status\" ADD VALUE IF NOT EXISTS 'Inactive'",
    );
    await queryInterface.sequelize.query(`
      UPDATE classes c SET status = 'Inactive'
      WHERE c.status = 'Active' AND c.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM students s
          WHERE s.fk_class_id = c.id AND s.archived_at IS NULL
            AND s.status NOT IN ('Withdrawn', 'StruckOff')
        )`);
  },

  async down(queryInterface) {
    // Postgres can't drop an enum value; fold Inactive back into Active.
    await queryInterface.sequelize.query("UPDATE classes SET status = 'Active' WHERE status = 'Inactive'");
  },
};
