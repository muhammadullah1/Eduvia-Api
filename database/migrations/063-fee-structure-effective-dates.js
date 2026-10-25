"use strict";

/**
 * Finance (Step 3): fee structure history.
 * - effective_from: the day an amount starts. A month is billed with the latest
 *   live row whose effective_from is on or before the 1st of that month.
 *   Existing rows (backfilled from the class fee) start on their session's start date.
 * - removed_reason / fk_removed_by_user_id: why and by whom a fee type was removed
 *   (the row is archived, never deleted or edited in place).
 * - The one-live-row-per-type index becomes one live row per type per effective date,
 *   so a fee change adds a row instead of overwriting the old amount.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      const add = (column, spec) => queryInterface.addColumn("fee_structures", column, spec, { transaction });
      await add("effective_from", { type: Sequelize.DATEONLY, allowNull: true });
      await add("removed_reason", { type: Sequelize.TEXT, allowNull: true });
      await add("fk_removed_by_user_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await q(`UPDATE fee_structures f SET effective_from = COALESCE(s.start_date, f.created_at::date)
               FROM academic_sessions s WHERE s.id = f.fk_session_id AND f.effective_from IS NULL`);
      await q(`UPDATE fee_structures SET effective_from = created_at::date WHERE effective_from IS NULL`);
      await queryInterface.changeColumn("fee_structures", "effective_from", { type: Sequelize.DATEONLY, allowNull: false }, { transaction });
      await q(`DROP INDEX IF EXISTS uq_fee_structures_class_type`);
      await q(`CREATE UNIQUE INDEX uq_fee_structures_class_type_effective ON fee_structures (fk_class_id, fee_type, effective_from) WHERE archived_at IS NULL`);
      await q(`CREATE INDEX idx_fee_structures_lookup ON fee_structures (fk_class_id, fee_type, effective_from DESC)`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      const [[dup]] = await q(`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM fee_structures WHERE archived_at IS NULL
                                 GROUP BY fk_class_id, fee_type HAVING COUNT(*) > 1) d`);
      if (dup.n > 0) {
        throw new Error(`Cannot undo 063: ${dup.n} class fee type(s) have more than one live effective-dated row. Nothing was changed.`);
      }
      await q(`DROP INDEX IF EXISTS idx_fee_structures_lookup`);
      await q(`DROP INDEX IF EXISTS uq_fee_structures_class_type_effective`);
      await q(`CREATE UNIQUE INDEX uq_fee_structures_class_type ON fee_structures (fk_class_id, fee_type) WHERE archived_at IS NULL`);
      for (const column of ["fk_removed_by_user_id", "removed_reason", "effective_from"]) {
        await queryInterface.removeColumn("fee_structures", column, { transaction });
      }
    });
  },
};
