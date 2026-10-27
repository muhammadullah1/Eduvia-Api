"use strict";

/**
 * Finance (Step 2): upload history for the offline fee import (Excel wizard).
 * fee_import_batches: one uploaded file (validated -> committed / discarded).
 * fee_import_rows: each data row with its parsed values, status and errors;
 * committed rows link to the fee_payments row they created.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await queryInterface.createTable(
        "fee_import_batches",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "schools", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
          file_name: { type: Sequelize.STRING(255), allowNull: false },
          file_hash: { type: Sequelize.STRING(64), allowNull: true },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "Validated" },
          total_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          valid_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          error_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          duplicate_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          imported_rows: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          total_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
          fk_uploaded_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          committed_at: { allowNull: true, type: Sequelize.DATE },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await q(`ALTER TABLE fee_import_batches
        ADD CONSTRAINT fee_import_batches_status_check CHECK (status IN ('Validated','Committed','Discarded','Failed')),
        ADD CONSTRAINT fee_import_batches_counts_check CHECK (total_rows >= 0 AND valid_rows >= 0 AND error_rows >= 0 AND duplicate_rows >= 0 AND imported_rows >= 0)`);
      await q(`CREATE INDEX idx_fee_import_batches_school ON fee_import_batches (fk_school_id, created_at)`);

      await queryInterface.createTable(
        "fee_import_rows",
        {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          fk_batch_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "fee_import_batches", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
          row_number: { type: Sequelize.INTEGER, allowNull: false },
          admission_no: { type: Sequelize.STRING(50), allowNull: true },
          fk_student_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "students", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          month: { type: Sequelize.STRING(255), allowNull: true },
          amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
          payment_date: { type: Sequelize.DATEONLY, allowNull: true },
          reference_no: { type: Sequelize.STRING(100), allowNull: true },
          payment_method: { type: Sequelize.STRING(20), allowNull: true },
          status: { type: Sequelize.STRING(20), allowNull: false },
          errors: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          raw: { type: Sequelize.JSONB, allowNull: true },
          fk_payment_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "fee_payments", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await q(`ALTER TABLE fee_import_rows
        ADD CONSTRAINT fee_import_rows_status_check CHECK (status IN ('Valid','Error','Duplicate','Imported','Skipped')),
        ADD CONSTRAINT fee_import_rows_amount_check CHECK (amount IS NULL OR amount >= 0)`);
      await q(`CREATE UNIQUE INDEX uq_fee_import_rows_batch_row ON fee_import_rows (fk_batch_id, row_number)`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("fee_import_rows", { transaction });
      await queryInterface.dropTable("fee_import_batches", { transaction });
    });
  },
};
