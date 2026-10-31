"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.class_subjects (\n    id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    periods_per_week integer DEFAULT 5,\n    is_elective boolean DEFAULT false NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    default_total_marks numeric(6,2) DEFAULT 100 NOT NULL,\n    default_passing_marks numeric(6,2) DEFAULT 40 NOT NULL,\n    CONSTRAINT chk_class_subjects_default_marks CHECK (((default_total_marks > (0)::numeric) AND (default_passing_marks >= (0)::numeric) AND (default_passing_marks <= default_total_marks)))\n);",
      "CREATE SEQUENCE public.class_subjects_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.class_subjects_id_seq OWNED BY public.class_subjects.id;",
      "ALTER TABLE ONLY public.class_subjects ALTER COLUMN id SET DEFAULT nextval('public.class_subjects_id_seq'::regclass);",
      "ALTER TABLE ONLY public.class_subjects\n    ADD CONSTRAINT class_subjects_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_class_subjects_class_subject_unique ON public.class_subjects USING btree (fk_class_id, fk_subject_id);",
      "ALTER TABLE ONLY public.class_subjects\n    ADD CONSTRAINT class_subjects_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.class_subjects\n    ADD CONSTRAINT class_subjects_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"class_subjects\";",
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
