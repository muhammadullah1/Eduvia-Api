"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.academic_sessions (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    name character varying(100) NOT NULL,\n    start_date date NOT NULL,\n    end_date date NOT NULL,\n    is_current boolean DEFAULT false NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.academic_sessions_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.academic_sessions_id_seq OWNED BY public.academic_sessions.id;",
      "ALTER TABLE ONLY public.academic_sessions ALTER COLUMN id SET DEFAULT nextval('public.academic_sessions_id_seq'::regclass);",
      "ALTER TABLE ONLY public.academic_sessions\n    ADD CONSTRAINT academic_sessions_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_academic_sessions_school_is_current ON public.academic_sessions USING btree (fk_school_id, is_current);",
      "CREATE UNIQUE INDEX idx_academic_sessions_school_name_unique ON public.academic_sessions USING btree (fk_school_id, name);",
      "ALTER TABLE ONLY public.academic_sessions\n    ADD CONSTRAINT academic_sessions_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"academic_sessions\";",
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
