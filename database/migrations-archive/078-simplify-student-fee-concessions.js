"use strict";

/**
 * Simplify concessions: single fee_type per row, reason FK, version chain,
 * drop fixed_payable (converted to fixed_discount), allow Superseded status.
 * Legacy columns (stackable, priority, family, category) remain for history
 * but are no longer written by the new API.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "student_fee_concessions",
        "fee_type",
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.addColumn(
        "student_fee_concessions",
        "fk_reason_id",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "school_concession_reasons",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        { transaction },
      );

      await queryInterface.addColumn(
        "student_fee_concessions",
        "fk_replaces_id",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "student_fee_concessions",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        { transaction },
      );

      // Backfill fee_type from the junction (first type per concession).
      await queryInterface.sequelize.query(
        `
        UPDATE student_fee_concessions c
           SET fee_type = sub.fee_type
          FROM (
            SELECT DISTINCT ON (fk_concession_id)
                   fk_concession_id, fee_type
              FROM student_fee_concession_fee_types
             ORDER BY fk_concession_id, id
          ) sub
         WHERE c.id = sub.fk_concession_id
           AND c.fee_type IS NULL
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        UPDATE student_fee_concessions
           SET fee_type = 'Tuition'
         WHERE fee_type IS NULL
        `,
        { transaction },
      );

      await queryInterface.changeColumn(
        "student_fee_concessions",
        "fee_type",
        {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "Tuition",
        },
        { transaction },
      );

      // Convert fixed_payable → fixed_discount using class Tuition when known.
      await queryInterface.sequelize.query(
        `
        UPDATE student_fee_concessions c
           SET mode = 'fixed_discount',
               value = GREATEST(
                 0,
                 COALESCE(
                   (
                     SELECT fs.amount
                       FROM students s
                       JOIN classes cl ON cl.id = s.fk_class_id
                       JOIN fee_structures fs
                         ON fs.fk_class_id = cl.id
                        AND fs.fee_type = 'Tuition'
                        AND fs.archived_at IS NULL
                        AND fs.effective_from <= c.effective_from
                      ORDER BY fs.effective_from DESC, fs.id DESC
                      LIMIT 1
                   ),
                   c.value
                 ) - c.value
               ),
               notes = CASE
                 WHEN c.notes IS NULL OR btrim(c.notes) = ''
                   THEN 'Converted from fixed_payable'
                 ELSE c.notes || ' | Converted from fixed_payable'
               END
         WHERE c.mode = 'fixed_payable'
           AND c.archived_at IS NULL
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          DROP CONSTRAINT IF EXISTS student_fee_concessions_mode_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          ADD CONSTRAINT student_fee_concessions_mode_check
          CHECK (mode IN ('fixed_discount', 'percent', 'waiver'))
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          DROP CONSTRAINT IF EXISTS student_fee_concessions_status_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          ADD CONSTRAINT student_fee_concessions_status_check
          CHECK (
            status IN (
              'Draft',
              'PendingApproval',
              'Approved',
              'Rejected',
              'Revoked',
              'Superseded'
            )
          )
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          ADD CONSTRAINT student_fee_concessions_fee_type_check
          CHECK (
            fee_type IN ('Tuition', 'Admission', 'Exam', 'Annual', 'Promotion')
          )
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        CREATE UNIQUE INDEX uq_concession_one_approved_per_student_type
          ON student_fee_concessions (fk_school_id, fk_student_id, fee_type)
          WHERE status = 'Approved' AND archived_at IS NULL
        `,
        { transaction },
      );

      await queryInterface.addIndex(
        "student_fee_concessions",
        ["fk_school_id", "status"],
        {
          name: "idx_concessions_school_status",
          transaction,
        },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS uq_concession_one_approved_per_student_type`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS idx_concessions_school_status`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          DROP CONSTRAINT IF EXISTS student_fee_concessions_fee_type_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          DROP CONSTRAINT IF EXISTS student_fee_concessions_status_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          ADD CONSTRAINT student_fee_concessions_status_check
          CHECK (
            status IN (
              'Draft',
              'PendingApproval',
              'Approved',
              'Rejected',
              'Revoked'
            )
          )
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          DROP CONSTRAINT IF EXISTS student_fee_concessions_mode_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE student_fee_concessions
          ADD CONSTRAINT student_fee_concessions_mode_check
          CHECK (
            mode IN (
              'fixed_payable',
              'fixed_discount',
              'percent',
              'waiver'
            )
          )
        `,
        { transaction },
      );
      await queryInterface.removeColumn("student_fee_concessions", "fk_replaces_id", {
        transaction,
      });
      await queryInterface.removeColumn("student_fee_concessions", "fk_reason_id", {
        transaction,
      });
      await queryInterface.removeColumn("student_fee_concessions", "fee_type", {
        transaction,
      });
    });
  },
};
