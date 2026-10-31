"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.daily_test_results (\n    id integer NOT NULL,\n    fk_daily_test_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    obtained_marks numeric(5,2),\n    is_absent boolean DEFAULT false NOT NULL,\n    remarks character varying(255),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_entered_by_user_id integer\n);",
      "CREATE SEQUENCE public.daily_test_results_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.daily_test_results_id_seq OWNED BY public.daily_test_results.id;",
      "ALTER TABLE ONLY public.daily_test_results ALTER COLUMN id SET DEFAULT nextval('public.daily_test_results_id_seq'::regclass);",
      "ALTER TABLE ONLY public.daily_test_results\n    ADD CONSTRAINT daily_test_results_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_daily_test_results_student ON public.daily_test_results USING btree (fk_student_id);",
      "CREATE UNIQUE INDEX idx_daily_test_results_test_student_unique ON public.daily_test_results USING btree (fk_daily_test_id, fk_student_id);",
      "ALTER TABLE ONLY public.daily_test_results\n    ADD CONSTRAINT daily_test_results_fk_daily_test_id_fkey FOREIGN KEY (fk_daily_test_id) REFERENCES public.daily_tests(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.daily_test_results\n    ADD CONSTRAINT daily_test_results_fk_entered_by_user_id_fkey FOREIGN KEY (fk_entered_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.daily_test_results\n    ADD CONSTRAINT daily_test_results_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"daily_test_results\";",
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
