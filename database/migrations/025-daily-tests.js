"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_daily_tests_status\" AS ENUM ('Scheduled', 'MarksEntered', 'Published');",
      "CREATE TABLE public.daily_tests (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    fk_teacher_id integer,\n    date date NOT NULL,\n    total_marks numeric(5,2) DEFAULT 20 NOT NULL,\n    title character varying(255),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_schedule_id integer,\n    month character varying(7) NOT NULL,\n    week_of_month integer,\n    published_at timestamp with time zone,\n    fk_published_by_user_id integer,\n    status public.enum_daily_tests_status DEFAULT 'Scheduled'::public.enum_daily_tests_status NOT NULL\n);",
      "CREATE SEQUENCE public.daily_tests_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.daily_tests_id_seq OWNED BY public.daily_tests.id;",
      "ALTER TABLE ONLY public.daily_tests ALTER COLUMN id SET DEFAULT nextval('public.daily_tests_id_seq'::regclass);",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX daily_tests_class_subject_date ON public.daily_tests USING btree (fk_class_id, fk_subject_id, date) WHERE (archived_at IS NULL);",
      "CREATE UNIQUE INDEX idx_daily_tests_class_subject_date_unique ON public.daily_tests USING btree (fk_class_id, fk_subject_id, date);",
      "CREATE INDEX idx_daily_tests_school_date ON public.daily_tests USING btree (fk_school_id, date);",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_published_by_user_id_fkey FOREIGN KEY (fk_published_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_schedule_id_fkey FOREIGN KEY (fk_schedule_id) REFERENCES public.daily_test_schedules(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_tests\n    ADD CONSTRAINT daily_tests_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"daily_tests\";",
      "DROP TYPE public.\"enum_daily_tests_status\";",
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
