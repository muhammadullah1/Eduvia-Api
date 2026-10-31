"use strict";

/**
 * Add Promotion as a OneTime fee type on fee_structures and student_fee_months.
 * Seed fee_type_policies rows for every school. Does not touch existing bills.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ENUM ADD VALUE cannot always run inside an open transaction on Postgres.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'enum_student_fee_months_fee_type'
             AND e.enumlabel = 'Promotion'
        ) THEN
          ALTER TYPE "enum_student_fee_months_fee_type" ADD VALUE 'Promotion';
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE fee_structures
          DROP CONSTRAINT IF EXISTS fee_structures_fee_type_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE fee_structures
          ADD CONSTRAINT fee_structures_fee_type_check
          CHECK (fee_type IN ('Tuition','Admission','Exam','Annual','Promotion'))
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
        INSERT INTO fee_type_policies (
          fk_school_id, fee_type, concession_eligible, active, label, created_at, updated_at
        )
        SELECT s.id, 'Promotion', TRUE, TRUE, 'Promotion', NOW(), NOW()
          FROM schools s
         WHERE NOT EXISTS (
           SELECT 1
             FROM fee_type_policies p
            WHERE p.fk_school_id = s.id
              AND p.fee_type = 'Promotion'
              AND p.archived_at IS NULL
         )
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        DELETE FROM fee_type_policies
         WHERE fee_type = 'Promotion'
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE fee_structures
          DROP CONSTRAINT IF EXISTS fee_structures_fee_type_check
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `
        ALTER TABLE fee_structures
          ADD CONSTRAINT fee_structures_fee_type_check
          CHECK (fee_type IN ('Tuition','Admission','Exam','Annual'))
        `,
        { transaction },
      );
    });
    // Postgres cannot easily remove an enum value; leave Promotion on the type.
  },
};
