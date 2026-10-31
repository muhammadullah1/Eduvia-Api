"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_daily_test_schedules_day_of_week\" AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');",
      "CREATE TABLE public.daily_test_schedules (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    day_of_week public.enum_daily_test_schedules_day_of_week NOT NULL,\n    fk_subject_id integer NOT NULL,\n    total_marks integer DEFAULT 20 NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.daily_test_schedules_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.daily_test_schedules_id_seq OWNED BY public.daily_test_schedules.id;",
      "ALTER TABLE ONLY public.daily_test_schedules ALTER COLUMN id SET DEFAULT nextval('public.daily_test_schedules_id_seq'::regclass);",
      "ALTER TABLE ONLY public.daily_test_schedules\n    ADD CONSTRAINT daily_test_schedules_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_daily_test_schedules_class_subject_day_active ON public.daily_test_schedules USING btree (fk_class_id, fk_subject_id, day_of_week) WHERE (archived_at IS NULL);",
      "CREATE INDEX idx_daily_test_schedules_school ON public.daily_test_schedules USING btree (fk_school_id);",
      "ALTER TABLE ONLY public.daily_test_schedules\n    ADD CONSTRAINT daily_test_schedules_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_test_schedules\n    ADD CONSTRAINT daily_test_schedules_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.daily_test_schedules\n    ADD CONSTRAINT daily_test_schedules_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"daily_test_schedules\";",
      "DROP TYPE public.\"enum_daily_test_schedules_day_of_week\";",
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
