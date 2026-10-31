"use strict";

/**
 * Finance (Step 2): one fee_structures row per class and fee type.
 * - fee_type: Tuition (Monthly), Admission (OneTime), Exam or Annual (Yearly).
 *   Only these four; Transport/Other stay on student_fee_months for old data.
 * - Tuition is backfilled from classes.monthly_tuition_fee, which is left in
 *   place (fee generation still reads it until Step 3 switches over).
 * - One live row per class + fee type (partial unique index on archived_at IS NULL).
 */
/** Idempotent (ON CONFLICT DO NOTHING); exported so the backfill can be tested. */
const BACKFILL_SQL = `INSERT INTO fee_structures (fk_school_id, fk_session_id, fk_class_id, fee_type, frequency, amount, created_at, updated_at)
        SELECT c.fk_school_id, c.fk_session_id, c.id, 'Tuition', 'Monthly', c.monthly_tuition_fee, NOW(), NOW()
        FROM classes c WHERE c.archived_at IS NULL
        ON CONFLICT (fk_class_id, fee_type) WHERE archived_at IS NULL DO NOTHING`;

module.exports = {
  BACKFILL_SQL,
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "fee_structures",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "schools", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
          fk_session_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "academic_sessions", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
          fk_class_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "classes", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
          fee_type: { type: Sequelize.STRING(20), allowNull: false },
          frequency: { type: Sequelize.STRING(20), allowNull: false },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
          fk_updated_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          archived_at: { allowNull: true, type: Sequelize.DATE },
        },
        { transaction },
      );
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`ALTER TABLE fee_structures
        ADD CONSTRAINT fee_structures_fee_type_check CHECK (fee_type IN ('Tuition','Admission','Exam','Annual')),
        ADD CONSTRAINT fee_structures_frequency_check CHECK (frequency IN ('Monthly','OneTime','Yearly')),
        ADD CONSTRAINT fee_structures_amount_check CHECK (amount >= 0)`);
      await q(`CREATE UNIQUE INDEX uq_fee_structures_class_type ON fee_structures (fk_class_id, fee_type) WHERE archived_at IS NULL`);
      await q(`CREATE INDEX idx_fee_structures_school_session ON fee_structures (fk_school_id, fk_session_id)`);
      await q(BACKFILL_SQL);
    });
  },

  async down(queryInterface) {
    // Only removes the table this migration created; classes.monthly_tuition_fee was never touched.
    await queryInterface.dropTable("fee_structures");
  },
};
