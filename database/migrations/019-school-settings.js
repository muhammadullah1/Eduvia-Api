"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.school_settings (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    key character varying(64) NOT NULL,\n    value jsonb NOT NULL,\n    fk_updated_by_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.school_settings_id_seq1\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.school_settings_id_seq1 OWNED BY public.school_settings.id;",
      "ALTER TABLE ONLY public.school_settings ALTER COLUMN id SET DEFAULT nextval('public.school_settings_id_seq1'::regclass);",
      "ALTER TABLE ONLY public.school_settings\n    ADD CONSTRAINT school_settings_pkey1 PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX school_settings_unique_key ON public.school_settings USING btree (fk_school_id, key) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.school_settings\n    ADD CONSTRAINT school_settings_fk_school_id_fkey1 FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.school_settings\n    ADD CONSTRAINT school_settings_fk_updated_by_user_id_fkey FOREIGN KEY (fk_updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"school_settings\";",
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
