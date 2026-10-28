"use strict";

/**
 * Idempotent backfill: students with fixed_monthly_fee > 0 get an Approved
 * Tuition fixed_payable concession for their current class session.
 * Does NOT touch discount_percent or existing fee months.
 * Safe to re-run: skips students that already have a migrated concession note.
 */
const MARKER = "Migrated from fixed_monthly_fee";

function rowsFromQuery(result) {
  if (!Array.isArray(result)) return [];
  for (const part of result) {
    if (Array.isArray(part)) return part;
  }
  return [];
}

function firstRow(rows) {
  for (const row of rows) {
    return row;
  }
  return null;
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql, replacements) =>
        queryInterface.sequelize.query(sql, { transaction, replacements });

      const studentResult = await q(
        `
        SELECT s.id AS student_id, s.fk_school_id, s.fixed_monthly_fee, c.fk_session_id, sess.start_date
          FROM students s
          JOIN classes c ON c.id = s.fk_class_id AND c.archived_at IS NULL
          JOIN academic_sessions sess ON sess.id = c.fk_session_id
         WHERE s.archived_at IS NULL
           AND s.fixed_monthly_fee IS NOT NULL
           AND s.fixed_monthly_fee > 0
           AND NOT EXISTS (
             SELECT 1 FROM student_fee_concessions x
              WHERE x.fk_student_id = s.id
                AND x.notes = :marker
                AND x.archived_at IS NULL
           )
      `,
        { marker: MARKER },
      );
      const students = rowsFromQuery(studentResult);

      for (const row of students) {
        const insertResult = await q(
          `
          INSERT INTO student_fee_concessions (
            fk_school_id, fk_session_id, fk_student_id, category, mode, value, priority, stackable,
            effective_from, status, reason, notes, approved_at, created_at, updated_at
          ) VALUES (
            :schoolId, :sessionId, :studentId, 'Standard', 'fixed_payable', :value, 100, FALSE,
            :from, 'Approved', :reason, :marker, NOW(), NOW(), NOW()
          ) RETURNING id
        `,
          {
            schoolId: row.fk_school_id,
            sessionId: row.fk_session_id,
            studentId: row.student_id,
            value: row.fixed_monthly_fee,
            from: row.start_date,
            reason: MARKER,
            marker: MARKER,
          },
        );
        const inserted = firstRow(rowsFromQuery(insertResult));
        if (!inserted) continue;
        const concessionId = inserted.id;
        await q(
          `
          INSERT INTO student_fee_concession_fee_types (fk_concession_id, fee_type, created_at, updated_at)
          VALUES (:id, 'Tuition', NOW(), NOW())
        `,
          { id: concessionId },
        );
        await q(
          `
          INSERT INTO student_fee_concession_events (
            fk_concession_id, event_type, from_status, to_status, payload, created_at
          ) VALUES (
            :id, 'Migrated', NULL, 'Approved', '{"source":"fixed_monthly_fee"}'::jsonb, NOW()
          )
        `,
          { id: concessionId },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`DELETE FROM student_fee_concession_events WHERE event_type = 'Migrated'`);
      await q(`DELETE FROM student_fee_concession_fee_types WHERE fk_concession_id IN (
        SELECT id FROM student_fee_concessions WHERE notes = '${MARKER}')`);
      await q(`DELETE FROM student_fee_concessions WHERE notes = '${MARKER}'`);
    });
  },
};
