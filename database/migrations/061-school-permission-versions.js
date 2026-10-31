"use strict";

/**
 * One counter per school, bumped in the same transaction as any change to that school's roles or
 * grants. Every API process compares it with the version its permission cache was loaded at and
 * reloads on a mismatch, so a change made through one instance applies on all of them at once.
 * Rows are created on first bump; a missing row reads as version 0. `down` drops the table only.
 */

const UP = [
  `CREATE TABLE public.school_permission_versions (
    fk_school_id integer NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT school_permission_versions_pkey PRIMARY KEY (fk_school_id),
    CONSTRAINT school_permission_versions_version_check CHECK ((version >= 1)),
    CONSTRAINT school_permission_versions_fk_school_id_fkey FOREIGN KEY (fk_school_id)
      REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE
  );`,
];

const DOWN = ["DROP TABLE IF EXISTS public.school_permission_versions;"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of UP)
        await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of DOWN)
        await queryInterface.sequelize.query(sql, { transaction });
    });
  },
};
