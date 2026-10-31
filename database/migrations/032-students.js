"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_students_gender\" AS ENUM ('Male', 'Female', 'Other');",
      "CREATE TYPE public.\"enum_students_status\" AS ENUM ('Active', 'Pending', 'Inactive', 'Graduated', 'StruckOff', 'Withdrawn');",
      "CREATE TABLE public.students (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer,\n    admission_no character varying(50) NOT NULL,\n    first_name character varying(100) NOT NULL,\n    last_name character varying(100) NOT NULL,\n    gender public.enum_students_gender NOT NULL,\n    date_of_birth date NOT NULL,\n    blood_group character varying(10),\n    admission_date date NOT NULL,\n    status public.enum_students_status DEFAULT 'Active'::public.enum_students_status NOT NULL,\n    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,\n    fixed_monthly_fee numeric(12,2),\n    photo character varying(500),\n    emergency_contact character varying(50),\n    address text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.students_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;",
      "ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);",
      "ALTER TABLE ONLY public.students\n    ADD CONSTRAINT students_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_students_school_admission_no_unique ON public.students USING btree (fk_school_id, admission_no);",
      "CREATE INDEX idx_students_school_class_status ON public.students USING btree (fk_school_id, fk_class_id, status);",
      "ALTER TABLE ONLY public.students\n    ADD CONSTRAINT students_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.students\n    ADD CONSTRAINT students_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"students\";",
      "DROP TYPE public.\"enum_students_gender\";",
      "DROP TYPE public.\"enum_students_status\";",
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
