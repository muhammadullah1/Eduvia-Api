"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_mark_sheets_status\" AS ENUM ('Draft', 'Submitted', 'Verified', 'Published');",
      "CREATE TABLE public.mark_sheets (\n    id integer NOT NULL,\n    fk_exam_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    total_marks numeric(6,2) DEFAULT 100 NOT NULL,\n    passing_marks numeric(6,2) DEFAULT 40 NOT NULL,\n    status public.enum_mark_sheets_status DEFAULT 'Draft'::public.enum_mark_sheets_status NOT NULL,\n    fk_submitted_by_user_id integer,\n    fk_approved_by_user_id integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_school_id integer NOT NULL,\n    fk_teacher_id integer,\n    published_at timestamp with time zone,\n    fk_published_by_user_id integer,\n    paper_date date,\n    start_time time without time zone,\n    end_time time without time zone,\n    CONSTRAINT chk_mark_sheets_paper_marks CHECK (((total_marks > (0)::numeric) AND (passing_marks >= (0)::numeric) AND (passing_marks <= total_marks))),\n    CONSTRAINT chk_mark_sheets_paper_time CHECK (((start_time IS NULL) OR (end_time IS NULL) OR (end_time > start_time)))\n);",
      "CREATE SEQUENCE public.mark_sheets_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.mark_sheets_id_seq OWNED BY public.mark_sheets.id;",
      "ALTER TABLE ONLY public.mark_sheets ALTER COLUMN id SET DEFAULT nextval('public.mark_sheets_id_seq'::regclass);",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_mark_sheets_class_subject ON public.mark_sheets USING btree (fk_class_id, fk_subject_id);",
      "CREATE UNIQUE INDEX idx_mark_sheets_exam_class_subject_unique ON public.mark_sheets USING btree (fk_exam_id, fk_class_id, fk_subject_id);",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_approved_by_user_id_fkey FOREIGN KEY (fk_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_exam_id_fkey FOREIGN KEY (fk_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_published_by_user_id_fkey FOREIGN KEY (fk_published_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_submitted_by_user_id_fkey FOREIGN KEY (fk_submitted_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.mark_sheets\n    ADD CONSTRAINT mark_sheets_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"mark_sheets\";",
      "DROP TYPE public.\"enum_mark_sheets_status\";",
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
