"use strict";

/**
 * Repairs admission checklists saved before re-saving was idempotent, then makes duplicates impossible.
 * Per application: keeps the oldest row of each title, removes later copies and admission rows no longer
 * on the checklist (the retired Medical / Vaccination Record), adds any missing required document as
 * Pending, then adds a unique index on (fk_application_id, title).
 * A row with a file (anything but empty or the "pending://" placeholder) is never removed: if one would
 * be, the migration stops, changes nothing and lists them.
 * Down drops the index only; removed rows come back from the pre-migration backup, not from here.
 */

const { REQUIRED_ADMISSION_DOCUMENTS, ADMISSION_DOCUMENT_TYPE, INITIAL_DOCUMENT_STATUS } = require("../../constants/admissions");

const TABLE = "application_documents";
const INDEX = "application_documents_application_title_unique";
const PLACEHOLDER = /^pending:\/\//;
const LISTED_CONFLICTS = 20;

const REMOVABLE = `
  SELECT id, fk_application_id, title, file_url FROM (
    SELECT d.*, row_number() OVER (PARTITION BY fk_application_id, title ORDER BY id) AS copy
    FROM ${TABLE} d
  ) ranked
  WHERE copy > 1 OR (document_type = :type AND title NOT IN (:required))`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;
    await db.transaction(async (transaction) => {
      const replacements = { type: ADMISSION_DOCUMENT_TYPE, required: [...REQUIRED_ADMISSION_DOCUMENTS], status: INITIAL_DOCUMENT_STATUS };
      const [removable] = await db.query(REMOVABLE, { replacements, transaction });
      const withFiles = removable.filter((row) => row.file_url && !PLACEHOLDER.test(row.file_url));
      if (withFiles.length) {
        const list = withFiles
          .slice(0, LISTED_CONFLICTS)
          .map((row) => `#${row.id} app ${row.fk_application_id} "${row.title}"`)
          .join(", ");
        throw new Error(`Not removing ${withFiles.length} document row(s) that hold a file: ${list}. Resolve them by hand, then re-run.`);
      }
      const ids = removable.map((row) => row.id);
      if (ids.length) await db.query(`DELETE FROM ${TABLE} WHERE id IN (:ids)`, { replacements: { ids }, transaction });
      await db.query(
        `INSERT INTO ${TABLE} (fk_application_id, title, status, file_url, document_type, created_at, updated_at)
         SELECT a.id, r.title, CAST(:status AS enum_application_documents_status), NULL, :type, now(), now()
         FROM applications a CROSS JOIN unnest(ARRAY[:required]::text[]) AS r(title)
         WHERE NOT EXISTS (SELECT 1 FROM ${TABLE} d WHERE d.fk_application_id = a.id AND d.title = r.title)`,
        { replacements, transaction },
      );
      await queryInterface.addIndex(TABLE, ["fk_application_id", "title"], { name: INDEX, unique: true, transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, INDEX);
  },
};
