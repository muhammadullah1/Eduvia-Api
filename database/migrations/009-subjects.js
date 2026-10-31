"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.subjects (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    name character varying(100) NOT NULL,\n    code character varying(50),\n    category character varying(50),\n    is_active boolean DEFAULT true NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.subjects_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;",
      "ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);",
      "ALTER TABLE ONLY public.subjects\n    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_subjects_school_name_active_unique ON public.subjects USING btree (fk_school_id, lower((name)::text)) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.subjects\n    ADD CONSTRAINT subjects_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"subjects\";",
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
