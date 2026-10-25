"use strict";

/**
 * Finance (Step 2):
 * - other_incomes: money received that is not a student fee (canteen, rent,
 *   donations ...), same shape as expenses.
 * - expenses.payment_method (nullable; existing rows stay NULL = not recorded).
 * - Money columns widened DECIMAL(10,2) -> DECIMAL(12,2). Same scale, larger
 *   precision: no value can change and Postgres does not rewrite the data.
 *   down() narrows back only if every value still fits, otherwise it stops.
 * Expense / income categories are an app-level list (constants/finance.js);
 * existing free-text expense categories are not rewritten.
 */
const WIDEN = [
  ["classes", "monthly_tuition_fee"],
  ["students", "fixed_monthly_fee"],
  ["expenses", "amount"],
  ["fee_payments", "amount_paid"],
  ["fee_payments", "unallocated_amount"],
  ["fee_allocations", "allocated_amount"],
  ["student_fee_months", "base_amount"],
  ["student_fee_months", "discount_amount"],
  ["student_fee_months", "net_amount"],
  ["student_fee_months", "paid_amount"],
];
const METHODS = "('Cash','BankTransfer','Cheque','Online')";

module.exports = {
  WIDEN,
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await queryInterface.createTable(
        "other_incomes",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "schools", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
          title: { type: Sequelize.STRING(255), allowNull: false },
          category: { type: Sequelize.STRING(100), allowNull: false },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
          income_date: { type: Sequelize.DATEONLY, allowNull: false },
          payment_method: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "Cash" },
          reference_no: { type: Sequelize.STRING(100), allowNull: true },
          received_from: { type: Sequelize.STRING(255), allowNull: true },
          notes: { type: Sequelize.TEXT, allowNull: true },
          fk_recorded_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          archived_at: { allowNull: true, type: Sequelize.DATE },
        },
        { transaction },
      );
      await q(`ALTER TABLE other_incomes
        ADD CONSTRAINT other_incomes_amount_check CHECK (amount > 0),
        ADD CONSTRAINT other_incomes_payment_method_check CHECK (payment_method IN ${METHODS})`);
      await q(`CREATE INDEX idx_other_incomes_school_date ON other_incomes (fk_school_id, income_date)`);

      await queryInterface.addColumn("expenses", "payment_method", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await q(`ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ${METHODS})`);

      for (const [table, column] of WIDEN) await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE NUMERIC(12,2)`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      for (const [table, column] of WIDEN) {
        const [[row]] = await q(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE ABS("${column}") >= 100000000`);
        if (row.n > 0) throw new Error(`Cannot narrow ${table}.${column}: ${row.n} value(s) need DECIMAL(12,2). Nothing was changed.`);
      }
      for (const [table, column] of WIDEN) await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE NUMERIC(10,2)`);
      await q(`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check`);
      await queryInterface.removeColumn("expenses", "payment_method", { transaction });
      await queryInterface.dropTable("other_incomes", { transaction });
    });
  },
};
