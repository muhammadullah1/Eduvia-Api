"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_daily_lessons_review_status\" AS ENUM ('Submitted', 'Approved', 'Rejected');",
      "CREATE TABLE public.daily_lessons (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    fk_teacher_id integer NOT NULL,\n    fk_chapter_id integer,\n    date date NOT NULL,\n    topic character varying(255) NOT NULL,\n    homework text,\n    notes text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    classwork text,\n    review_status public.enum_daily_lessons_review_status DEFAULT 'Submitted'::public.enum_daily_lessons_review_status NOT NULL,\n    fk_submitted_by_user_id integer,\n    fk_reviewed_by_user_id integer,\n    reviewed_at timestamp with time zone,\n    review_note text\n);",
      "CREATE SEQUENCE public.daily_lessons_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.daily_lessons_id_seq OWNED BY public.daily_lessons.id;",
      "ALTER TABLE ONLY public.daily_lessons ALTER COLUMN id SET DEFAULT nextval('public.daily_lessons_id_seq'::regclass);",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_daily_lessons_class_subject_date ON public.daily_lessons USING btree (fk_class_id, fk_subject_id, date);",
      "CREATE INDEX idx_daily_lessons_school_date ON public.daily_lessons USING btree (fk_school_id, date);",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_chapter_id_fkey FOREIGN KEY (fk_chapter_id) REFERENCES public.planned_chapters(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_reviewed_by_user_id_fkey FOREIGN KEY (fk_reviewed_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_submitted_by_user_id_fkey FOREIGN KEY (fk_submitted_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_lessons\n    ADD CONSTRAINT daily_lessons_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"daily_lessons\";",
      "DROP TYPE public.\"enum_daily_lessons_review_status\";",
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
