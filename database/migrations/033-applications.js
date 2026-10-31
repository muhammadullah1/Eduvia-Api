"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_applications_gender\" AS ENUM ('Male', 'Female', 'Other');",
      "CREATE TYPE public.\"enum_applications_status\" AS ENUM ('New', 'Review', 'Waitlist', 'Enrolled', 'Rejected');",
      "CREATE TABLE public.applications (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    applicant_first_name character varying(100) NOT NULL,\n    applicant_last_name character varying(100) NOT NULL,\n    gender public.enum_applications_gender NOT NULL,\n    date_of_birth date NOT NULL,\n    grade_applying_for character varying(50) NOT NULL,\n    parent_name character varying(100) NOT NULL,\n    parent_email character varying(255),\n    parent_phone character varying(50) NOT NULL,\n    status public.enum_applications_status DEFAULT 'New'::public.enum_applications_status NOT NULL,\n    notes text,\n    enrolled_student_id integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_class_id integer,\n    decision character varying(20),\n    address text,\n    previous_school character varying(255),\n    previous_class character varying(100),\n    guardian_relation character varying(50),\n    guardian_address text,\n    interview_type character varying(50),\n    interview_date date,\n    interview_score character varying(20),\n    interview_result character varying(50),\n    submitted_on date\n);",
      "CREATE SEQUENCE public.applications_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;",
      "ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);",
      "ALTER TABLE ONLY public.applications\n    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_applications_school_session ON public.applications USING btree (fk_school_id, fk_session_id);",
      "CREATE INDEX idx_applications_school_status ON public.applications USING btree (fk_school_id, status);",
      "ALTER TABLE ONLY public.applications\n    ADD CONSTRAINT applications_enrolled_student_id_fkey FOREIGN KEY (enrolled_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.applications\n    ADD CONSTRAINT applications_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.applications\n    ADD CONSTRAINT applications_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.applications\n    ADD CONSTRAINT applications_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"applications\";",
      "DROP TYPE public.\"enum_applications_gender\";",
      "DROP TYPE public.\"enum_applications_status\";",
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
