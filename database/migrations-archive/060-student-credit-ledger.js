"use strict";

/**
 * Finance (Step 2): student credit ledger. Credit is only applied to future
 * fees, never refunded. Each row is one movement:
 * - Credit: money left over from a payment (amount > 0);
 * - Applied: credit used against a fee month;
 * - Reversal: a credit or application undone (e.g. payment voided).
 * Balance = SUM(Credit) - SUM(Applied) +/- Reversal, computed by the service.
 * Backfill: one Credit row per live payment with unallocated_amount > 0
 * (source 'backfill'); fee_payments.unallocated_amount is left as it is.
 */
/** Idempotent (ON CONFLICT DO NOTHING); exported so the backfill can be tested. */
const BACKFILL_SQL = `INSERT INTO student_credit_ledger (fk_school_id, fk_student_id, entry_type, amount, source, fk_payment_id, notes, created_at, updated_at)
        SELECT p.fk_school_id, p.fk_student_id, 'Credit', p.unallocated_amount, 'backfill', p.id,
               'Unallocated amount carried from receipt ' || p.receipt_no, NOW(), NOW()
        FROM fee_payments p WHERE p.archived_at IS NULL AND p.unallocated_amount > 0
        ON CONFLICT (fk_payment_id) WHERE source = 'backfill' DO NOTHING`;

module.exports = {
  BACKFILL_SQL,
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "student_credit_ledger",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "schools", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
          fk_student_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "students", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
          entry_type: { type: Sequelize.STRING(20), allowNull: false },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "payment" },
          fk_payment_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "fee_payments", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          fk_fee_month_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "student_fee_months", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          notes: { type: Sequelize.TEXT, allowNull: true },
          fk_created_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`ALTER TABLE student_credit_ledger
        ADD CONSTRAINT student_credit_ledger_entry_type_check CHECK (entry_type IN ('Credit','Applied','Reversal')),
        ADD CONSTRAINT student_credit_ledger_source_check CHECK (source IN ('payment','backfill','import','manual')),
        ADD CONSTRAINT student_credit_ledger_amount_check CHECK (amount > 0)`);
      await q(`CREATE INDEX idx_credit_ledger_student ON student_credit_ledger (fk_school_id, fk_student_id)`);
      await q(`CREATE UNIQUE INDEX uq_credit_ledger_backfill_payment ON student_credit_ledger (fk_payment_id) WHERE source = 'backfill'`);
      await q(BACKFILL_SQL);
    });
  },

  async down(queryInterface) {
    // Ledger rows are derived; fee_payments.unallocated_amount still holds the source values.
    await queryInterface.dropTable("student_credit_ledger");
  },
};
