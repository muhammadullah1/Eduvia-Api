"use strict";

/**
 * Finance Step 7 (offline sync): commit bookkeeping for fee_import_batches.
 * - commit_key: the client's Idempotency-Key for the commit call (unique per school),
 *   so a retried commit replays the same result instead of running twice.
 * - status 'Committing': the batch is claimed and its rows are being imported.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await queryInterface.addColumn("fee_import_batches", "commit_key", { type: Sequelize.STRING(120), allowNull: true }, { transaction });
      await q(`CREATE UNIQUE INDEX uq_fee_import_batches_commit_key ON fee_import_batches (fk_school_id, commit_key) WHERE commit_key IS NOT NULL`);
      await q(`CREATE INDEX idx_fee_import_batches_file_hash ON fee_import_batches (fk_school_id, file_hash)`);
      await q(`ALTER TABLE fee_import_batches DROP CONSTRAINT fee_import_batches_status_check`);
      await q(`ALTER TABLE fee_import_batches ADD CONSTRAINT fee_import_batches_status_check CHECK (status IN ('Validated','Committing','Committed','Discarded','Failed'))`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await q(`UPDATE fee_import_batches SET status = 'Failed' WHERE status = 'Committing'`);
      await q(`ALTER TABLE fee_import_batches DROP CONSTRAINT fee_import_batches_status_check`);
      await q(`ALTER TABLE fee_import_batches ADD CONSTRAINT fee_import_batches_status_check CHECK (status IN ('Validated','Committed','Discarded','Failed'))`);
      await q(`DROP INDEX IF EXISTS idx_fee_import_batches_file_hash`);
      await q(`DROP INDEX IF EXISTS uq_fee_import_batches_commit_key`);
      await queryInterface.removeColumn("fee_import_batches", "commit_key", { transaction });
    });
  },
};
