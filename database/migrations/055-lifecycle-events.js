"use strict";

/**
 * Student lifecycle (SRS 4.3.3): every status change is one permanent
 * student_status_events row. This adds what the lifecycle needs to record:
 * - event_type: Enrolled, Deactivated, Reactivated, Graduated, StruckOff,
 *   Withdrawn or Readmitted (derived from from/to status for existing rows);
 * - reason_category: the reason group (Leave, Transfer out, Disciplinary …);
 * - fk_to_class_id: the class a readmitted/enrolled student joins;
 * - outstanding_amount: fees owed when the student was struck off;
 * - transfer_to_school: where a transferred-out student went;
 * - graduation_override: graduated from a class that is not the final grade.
 * Students who were Withdrawn after being Active become StruckOff with
 * category "Withdrawn by parent" (Withdrawn is kept for Pending enrollments).
 */
const EVENT_TYPE_SQL = `
  CASE
    WHEN to_status = 'Graduated' THEN 'Graduated'
    WHEN to_status = 'StruckOff' THEN 'StruckOff'
    WHEN to_status = 'Withdrawn' THEN 'Withdrawn'
    WHEN to_status = 'Inactive' THEN 'Deactivated'
    WHEN to_status = 'Active' AND from_status = 'Inactive' THEN 'Reactivated'
    WHEN to_status = 'Active' AND from_status = 'Pending' THEN 'Enrolled'
    WHEN to_status = 'Active' THEN 'Readmitted'
    ELSE 'Other'
  END`;

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const add = (column, spec) => queryInterface.addColumn("student_status_events", column, spec, { transaction });
      await add("event_type", { type: Sequelize.STRING(20), allowNull: true });
      await add("reason_category", { type: Sequelize.STRING(40), allowNull: true });
      await add("fk_to_class_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "classes", key: "id" },
        onDelete: "SET NULL",
      });
      await add("outstanding_amount", { type: Sequelize.DECIMAL(12, 2), allowNull: true });
      await add("transfer_to_school", { type: Sequelize.STRING(255), allowNull: true });
      await add("graduation_override", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });

      // Withdrawn after being Active is a strike-off under the SRS.
      await queryInterface.sequelize.query(
        `WITH moved AS (
           SELECT s.id, s.fk_school_id, s.fk_class_id FROM students s
           WHERE s.status = 'Withdrawn' AND (
             EXISTS (SELECT 1 FROM student_status_events e WHERE e.fk_student_id = s.id AND e.from_status <> 'Pending')
             OR EXISTS (SELECT 1 FROM student_promotions p WHERE p.fk_student_id = s.id))
         ), events AS (
           INSERT INTO student_status_events
             (fk_school_id, fk_student_id, from_status, to_status, reason, effective_on, fk_class_id, created_at, updated_at)
           SELECT fk_school_id, id, 'Withdrawn', 'StruckOff', 'Withdrawn after enrollment (migrated to Struck off)', CURRENT_DATE, fk_class_id, NOW(), NOW()
           FROM moved RETURNING fk_student_id
         )
         UPDATE students SET status = 'StruckOff' WHERE id IN (SELECT fk_student_id FROM events)`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE student_status_events SET event_type = ${EVENT_TYPE_SQL},
           reason_category = COALESCE(reason_category, CASE WHEN reason LIKE 'Withdrawn after enrollment%' THEN 'Withdrawn by parent' ELSE 'Other' END)`,
        { transaction },
      );
      await queryInterface.changeColumn("student_status_events", "event_type", { type: Sequelize.STRING(20), allowNull: false }, { transaction });
      await queryInterface.addIndex("student_status_events", ["fk_school_id", "effective_on"], { name: "idx_status_events_school_date", transaction });
      await queryInterface.addIndex("student_status_events", ["fk_student_id"], { name: "idx_status_events_student", transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("student_status_events", "idx_status_events_student", { transaction });
      await queryInterface.removeIndex("student_status_events", "idx_status_events_school_date", { transaction });
      for (const column of ["graduation_override", "transfer_to_school", "outstanding_amount", "fk_to_class_id", "reason_category", "event_type"]) {
        await queryInterface.removeColumn("student_status_events", column, { transaction });
      }
    });
  },
};
