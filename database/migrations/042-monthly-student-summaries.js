"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_monthly_student_summaries_fee_status\" AS ENUM ('Paid', 'Partial', 'Unpaid');",
      "CREATE TABLE public.monthly_student_summaries (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    month character varying(7) NOT NULL,\n    attendance_percentage numeric(5,2),\n    daily_test_percentage numeric(5,2),\n    fee_status public.enum_monthly_student_summaries_fee_status,\n    teacher_remarks text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_class_id integer,\n    fk_subject_id integer,\n    tests_scheduled integer DEFAULT 0 NOT NULL,\n    tests_taken integer DEFAULT 0 NOT NULL,\n    passed_count integer DEFAULT 0 NOT NULL,\n    failed_count integer DEFAULT 0 NOT NULL,\n    status character varying(20),\n    flagged_for_follow_up boolean DEFAULT false NOT NULL\n);",
      "CREATE SEQUENCE public.monthly_student_summaries_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.monthly_student_summaries_id_seq OWNED BY public.monthly_student_summaries.id;",
      "ALTER TABLE ONLY public.monthly_student_summaries ALTER COLUMN id SET DEFAULT nextval('public.monthly_student_summaries_id_seq'::regclass);",
      "ALTER TABLE ONLY public.monthly_student_summaries\n    ADD CONSTRAINT monthly_student_summaries_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_monthly_summaries_school_month ON public.monthly_student_summaries USING btree (fk_school_id, month);",
      "CREATE UNIQUE INDEX idx_monthly_summaries_student_month_unique ON public.monthly_student_summaries USING btree (fk_student_id, month);",
      "CREATE UNIQUE INDEX monthly_student_summaries_subject_month ON public.monthly_student_summaries USING btree (fk_student_id, fk_class_id, fk_subject_id, month) WHERE ((fk_class_id IS NOT NULL) AND (fk_subject_id IS NOT NULL) AND (archived_at IS NULL));",
      "ALTER TABLE ONLY public.monthly_student_summaries\n    ADD CONSTRAINT monthly_student_summaries_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.monthly_student_summaries\n    ADD CONSTRAINT monthly_student_summaries_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.monthly_student_summaries\n    ADD CONSTRAINT monthly_student_summaries_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.monthly_student_summaries\n    ADD CONSTRAINT monthly_student_summaries_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"monthly_student_summaries\";",
      "DROP TYPE public.\"enum_monthly_student_summaries_fee_status\";",
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
