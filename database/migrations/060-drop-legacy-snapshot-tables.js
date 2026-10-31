"use strict";

/**
 * Drops exam_marks_legacy and fee_due_legacy. Archived migration 047 created them only so its
 * `down` could restore old exam marks and fee due dates; no application code reads them.
 * A database built from this folder never has them, so `up` is a no-op there.
 *
 * `down` recreates the empty tables. Their rows are not restorable from here; restore them from
 * the pg_dump taken before the switch-over (see docs in database/MIGRATIONS.md).
 */

const UP = ["DROP TABLE IF EXISTS public.exam_marks_legacy;", "DROP TABLE IF EXISTS public.fee_due_legacy;"];

const DOWN = [
  `CREATE TABLE public.exam_marks_legacy (
    kind character varying(10) NOT NULL,
    ref_id integer NOT NULL,
    total_marks numeric(6,2) NOT NULL,
    passing_marks numeric(6,2) NOT NULL,
    CONSTRAINT exam_marks_legacy_pkey PRIMARY KEY (kind, ref_id)
  );`,
  `CREATE TABLE public.fee_due_legacy (
    fee_month_id integer NOT NULL,
    due_date date,
    CONSTRAINT fee_due_legacy_pkey PRIMARY KEY (fee_month_id)
  );`,
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of UP) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of DOWN) await queryInterface.sequelize.query(sql, { transaction });
    });
  },
};
