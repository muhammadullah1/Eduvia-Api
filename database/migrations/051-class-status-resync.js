"use strict";

/**
 * Class status is now derived from enrolment (Active when it has students who
 * are not Withdrawn, StruckOff or Graduated; otherwise Inactive). Bring
 * existing rows in line once; services keep it in sync from here on.
 */
const ENROLLED = `
  SELECT 1 FROM students s
  WHERE s.fk_class_id = c.id AND s.archived_at IS NULL
    AND s.status NOT IN ('Withdrawn', 'StruckOff', 'Graduated')`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE classes c SET status = 'Inactive'
      WHERE c.status = 'Active' AND c.archived_at IS NULL AND NOT EXISTS (${ENROLLED})`);
    await queryInterface.sequelize.query(`
      UPDATE classes c SET status = 'Active'
      WHERE c.status = 'Inactive' AND c.archived_at IS NULL AND EXISTS (${ENROLLED})`);
  },

  async down() {
    // Data correction only; nothing to undo.
  },
};
