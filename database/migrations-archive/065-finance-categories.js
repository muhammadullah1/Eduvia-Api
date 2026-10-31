"use strict";

/**
 * Finance (Step 8): fixed categories, references and audited soft delete.
 *
 * - `category_key` on expenses / other_incomes: one of the fixed Figma lists
 *   (Staff Salary, Utilities, Supplies, Maintenance, Other / Donation, Grant, Misc).
 *   Existing rows are mapped from their free-text `category`, which is NOT
 *   changed: the original wording stays in `category`, so nothing is lost and
 *   down() is lossless. Anything that matches no rule maps to Other / Misc.
 * - `expenses.reference_no`: the reference / invoice number.
 * - `archive_reason` + `fk_archived_by_user_id`: why and by whom an entry was
 *   soft-deleted (`archived_at` already exists).
 */
const EXPENSE_KEYS = ["StaffSalary", "Utilities", "Supplies", "Maintenance", "Other"];
const INCOME_KEYS = ["Donation", "Grant", "Misc"];

/** First matching rule wins; patterns run on lower(trim(category)). Kept in sync with constants/finance.js. */
const EXPENSE_RULES = [
  ["StaffSalary", "salar|payroll|staff|wage|honorar|stipend"],
  ["Utilities", "utilit|electric|water|gas|internet|phone|telecom|power|bill"],
  ["Supplies", "suppl|station|book|material|chalk|paper|print|uniform|stock"],
  ["Maintenance", "mainten|repair|facilit|clean|renovat|fix"],
];
const INCOME_RULES = [
  ["Donation", "donat|zakat|charit|gift|sadaq"],
  ["Grant", "grant|subsid|government|govt"],
];

const caseSql = (rules, fallback) =>
  `CASE ${rules.map(([key, pattern]) => `WHEN lower(trim(category)) ~ '${pattern}' THEN '${key}'`).join(" ")} ELSE '${fallback}' END`;

module.exports = {
  EXPENSE_RULES,
  INCOME_RULES,
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      const archive = {
        archive_reason: { type: Sequelize.TEXT, allowNull: true },
        fk_archived_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      };
      for (const table of ["expenses", "other_incomes"]) {
        await queryInterface.addColumn(table, "category_key", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
        for (const [column, spec] of Object.entries(archive)) await queryInterface.addColumn(table, column, spec, { transaction });
      }
      await queryInterface.addColumn("expenses", "reference_no", { type: Sequelize.STRING(100), allowNull: true }, { transaction });

      await q(`UPDATE expenses SET category_key = ${caseSql(EXPENSE_RULES, "Other")}`);
      await q(`UPDATE other_incomes SET category_key = ${caseSql(INCOME_RULES, "Misc")}`);
      await q(`ALTER TABLE expenses ALTER COLUMN category_key SET NOT NULL,
        ADD CONSTRAINT expenses_category_key_check CHECK (category_key IN (${EXPENSE_KEYS.map((k) => `'${k}'`).join(",")}))`);
      await q(`ALTER TABLE other_incomes ALTER COLUMN category_key SET NOT NULL,
        ADD CONSTRAINT other_incomes_category_key_check CHECK (category_key IN (${INCOME_KEYS.map((k) => `'${k}'`).join(",")}))`);
      await q(`CREATE INDEX idx_other_incomes_school_category ON other_incomes (fk_school_id, category_key)`);
      await q(`CREATE INDEX idx_expenses_school_category ON expenses (fk_school_id, category_key)`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`DROP INDEX IF EXISTS idx_expenses_school_category`);
      await q(`DROP INDEX IF EXISTS idx_other_incomes_school_category`);
      await q(`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_key_check`);
      await q(`ALTER TABLE other_incomes DROP CONSTRAINT IF EXISTS other_incomes_category_key_check`);
      await queryInterface.removeColumn("expenses", "reference_no", { transaction });
      for (const table of ["expenses", "other_incomes"]) {
        for (const column of ["fk_archived_by_user_id", "archive_reason", "category_key"]) await queryInterface.removeColumn(table, column, { transaction });
      }
    });
  },
};
