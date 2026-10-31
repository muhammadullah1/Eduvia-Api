"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_exams_status\" AS ENUM ('Draft', 'Published', 'Archived', 'Scheduled', 'Marks Pending', 'Finalised');",
      "CREATE TABLE public.exams (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    name character varying(100) NOT NULL,\n    start_date date,\n    end_date date,\n    status public.enum_exams_status DEFAULT 'Draft'::public.enum_exams_status NOT NULL,\n    required_fee_month character varying(7),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_class_id integer NOT NULL,\n    exam_type character varying(40) DEFAULT 'Mid-Term'::character varying NOT NULL\n);",
      "CREATE SEQUENCE public.exams_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;",
      "ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);",
      "ALTER TABLE ONLY public.exams\n    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_exams_school_session ON public.exams USING btree (fk_school_id, fk_session_id);",
      "CREATE UNIQUE INDEX idx_exams_school_session_name_unique ON public.exams USING btree (fk_school_id, fk_session_id, name);",
      "ALTER TABLE ONLY public.exams\n    ADD CONSTRAINT exams_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.exams\n    ADD CONSTRAINT exams_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.exams\n    ADD CONSTRAINT exams_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"exams\";",
      "DROP TYPE public.\"enum_exams_status\";",
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
