"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_planned_chapters_status\" AS ENUM ('Planned', 'InProgress', 'Completed');",
      "CREATE TABLE public.planned_chapters (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    chapter_no integer NOT NULL,\n    title character varying(255) NOT NULL,\n    planned_start_date date,\n    planned_end_date date,\n    status public.enum_planned_chapters_status DEFAULT 'Planned'::public.enum_planned_chapters_status NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.planned_chapters_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.planned_chapters_id_seq OWNED BY public.planned_chapters.id;",
      "ALTER TABLE ONLY public.planned_chapters ALTER COLUMN id SET DEFAULT nextval('public.planned_chapters_id_seq'::regclass);",
      "ALTER TABLE ONLY public.planned_chapters\n    ADD CONSTRAINT planned_chapters_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_planned_chapters_class_subject_chapter_unique ON public.planned_chapters USING btree (fk_class_id, fk_subject_id, chapter_no);",
      "CREATE INDEX idx_planned_chapters_school_class_subject ON public.planned_chapters USING btree (fk_school_id, fk_class_id, fk_subject_id);",
      "ALTER TABLE ONLY public.planned_chapters\n    ADD CONSTRAINT planned_chapters_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.planned_chapters\n    ADD CONSTRAINT planned_chapters_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.planned_chapters\n    ADD CONSTRAINT planned_chapters_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.planned_chapters\n    ADD CONSTRAINT planned_chapters_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"planned_chapters\";",
      "DROP TYPE public.\"enum_planned_chapters_status\";",
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
