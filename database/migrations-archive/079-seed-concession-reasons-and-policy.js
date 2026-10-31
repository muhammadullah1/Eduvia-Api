"use strict";

/**
 * Seed default reasons per school, replace fees.concessionsEnabled with
 * fees.concessionPolicy, and migrate leftover fixed_monthly_fee into Approved
 * Tuition fixed_discount concessions when none exist yet.
 */

const SEED_REASONS = [
  { label: "Sibling", sort: 10, mode: "percent", value: 10 },
  { label: "Staff child", sort: 20, mode: "percent", value: 50 },
  { label: "Merit", sort: 30, mode: "percent", value: 25 },
  { label: "Hardship", sort: 40, mode: "fixed_discount", value: null },
  { label: "Orphan", sort: 50, mode: "waiver", value: 0 },
];

const DEFAULT_POLICY = {
  allowedModes: ["percent", "fixed_discount", "waiver"],
  approvalRule: "none",
  approvalPercentAbove: null,
  approvalAmountAbove: null,
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface.sequelize;

    await qi.transaction(async (transaction) => {
      const schools = await qi.query(`SELECT id FROM schools`, {
        type: qi.QueryTypes.SELECT,
        transaction,
      });

      for (const school of schools) {
        for (const reason of SEED_REASONS) {
          await qi.query(
            `
            INSERT INTO school_concession_reasons (
              fk_school_id, label, default_mode, default_value, sort_order, active, created_at, updated_at
            )
            SELECT :schoolId, :label, :mode, :value, :sort, TRUE, NOW(), NOW()
             WHERE NOT EXISTS (
               SELECT 1
                 FROM school_concession_reasons r
                WHERE r.fk_school_id = :schoolId
                  AND lower(r.label) = lower(:label)
                  AND r.archived_at IS NULL
             )
            `,
            {
              replacements: {
                schoolId: school.id,
                label: reason.label,
                mode: reason.mode,
                value: reason.value,
                sort: reason.sort,
              },
              transaction,
            },
          );
        }
      }

      // fees.concessionsEnabled → fees.concessionPolicy; drop the switch.
      await qi.query(
        `
        UPDATE school_settings
           SET value = (value - 'concessionsEnabled')
                          || jsonb_build_object('concessionPolicy', :policy::jsonb),
               updated_at = NOW()
         WHERE key = 'fees'
           AND NOT (value ? 'concessionPolicy')
        `,
        {
          replacements: { policy: JSON.stringify(DEFAULT_POLICY) },
          transaction,
        },
      );

      await qi.query(
        `
        UPDATE school_settings
           SET value = value - 'concessionsEnabled',
               updated_at = NOW()
         WHERE key = 'fees'
           AND value ? 'concessionsEnabled'
        `,
        { transaction },
      );

      // Remaining fixed_monthly_fee → Approved Tuition concession (discount vs structure).
      const fixedRows = await qi.query(
        `
        SELECT s.id AS student_id,
               s.fk_school_id,
               s.fixed_monthly_fee,
               c.fk_session_id,
               sess.start_date,
               (
                 SELECT fs.amount
                   FROM fee_structures fs
                  WHERE fs.fk_class_id = c.id
                    AND fs.fee_type = 'Tuition'
                    AND fs.archived_at IS NULL
                  ORDER BY fs.effective_from DESC, fs.id DESC
                  LIMIT 1
               ) AS tuition
          FROM students s
          JOIN classes c ON c.id = s.fk_class_id
          JOIN academic_sessions sess ON sess.id = c.fk_session_id
         WHERE s.archived_at IS NULL
           AND s.fixed_monthly_fee IS NOT NULL
           AND s.fixed_monthly_fee > 0
           AND NOT EXISTS (
             SELECT 1
               FROM student_fee_concessions x
              WHERE x.fk_student_id = s.id
                AND x.fee_type = 'Tuition'
                AND x.status = 'Approved'
                AND x.archived_at IS NULL
           )
        `,
        { type: qi.QueryTypes.SELECT, transaction },
      );

      for (const row of fixedRows) {
        const tuition = Number(row.tuition);
        const payable = Number(row.fixed_monthly_fee);
        let mode = "fixed_discount";
        let value = payable;
        if (Number.isFinite(tuition) && tuition > 0) {
          value = Math.max(0, Math.round((tuition - payable) * 100) / 100);
        }
        if (value === 0 && Number.isFinite(tuition) && tuition > 0 && payable === 0) {
          mode = "waiver";
        }
        await qi.query(
          `
          INSERT INTO student_fee_concessions (
            fk_school_id, fk_session_id, fk_student_id, category, mode, value,
            priority, stackable, effective_from, status, reason, notes, fee_type,
            approved_at, created_at, updated_at
          ) VALUES (
            :schoolId, :sessionId, :studentId, 'Standard', :mode, :value,
            100, FALSE, :from, 'Approved',
            'Migrated from fixed_monthly_fee',
            'Migrated from fixed_monthly_fee',
            'Tuition', NOW(), NOW(), NOW()
          )
          `,
          {
            replacements: {
              schoolId: row.fk_school_id,
              sessionId: row.fk_session_id,
              studentId: row.student_id,
              mode,
              value,
              from: row.start_date,
            },
            transaction,
          },
        );
      }
    });
  },

  async down(queryInterface) {
    const qi = queryInterface.sequelize;
    await qi.transaction(async (transaction) => {
      await qi.query(
        `
        UPDATE school_settings
           SET value = (value - 'concessionPolicy')
                          || jsonb_build_object('concessionsEnabled', false),
               updated_at = NOW()
         WHERE key = 'fees'
        `,
        { transaction },
      );
      await qi.query(
        `
        DELETE FROM school_concession_reasons
         WHERE label IN ('Sibling', 'Staff child', 'Merit', 'Hardship', 'Orphan')
        `,
        { transaction },
      );
    });
  },
};
