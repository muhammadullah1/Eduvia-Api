"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_teachers_status\" AS ENUM ('Active', 'OnLeave', 'Resigned', 'Terminated');",
      "CREATE TABLE public.teachers (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_user_id integer NOT NULL,\n    fk_subject_id integer,\n    employee_code character varying(50),\n    qualification character varying(255),\n    joining_date date,\n    status public.enum_teachers_status DEFAULT 'Active'::public.enum_teachers_status NOT NULL,\n    monthly_salary numeric(10,2),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.teachers_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.teachers_id_seq OWNED BY public.teachers.id;",
      "ALTER TABLE ONLY public.teachers ALTER COLUMN id SET DEFAULT nextval('public.teachers_id_seq'::regclass);",
      "ALTER TABLE ONLY public.teachers\n    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_teachers_school_employee_code_unique ON public.teachers USING btree (fk_school_id, employee_code);",
      "CREATE INDEX idx_teachers_school_status ON public.teachers USING btree (fk_school_id, status);",
      "CREATE UNIQUE INDEX idx_teachers_user_unique ON public.teachers USING btree (fk_user_id);",
      "ALTER TABLE ONLY public.teachers\n    ADD CONSTRAINT teachers_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.teachers\n    ADD CONSTRAINT teachers_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teachers\n    ADD CONSTRAINT teachers_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"teachers\";",
      "DROP TYPE public.\"enum_teachers_status\";",
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
