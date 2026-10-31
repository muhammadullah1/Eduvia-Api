"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_classes_status\" AS ENUM ('Active', 'Archived', 'Inactive');",
      "CREATE TABLE public.classes (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    grade character varying(50) NOT NULL,\n    section character varying(50) NOT NULL,\n    label character varying(100) NOT NULL,\n    room character varying(50),\n    period_count integer DEFAULT 8 NOT NULL,\n    capacity integer DEFAULT 50,\n    status public.enum_classes_status DEFAULT 'Active'::public.enum_classes_status NOT NULL,\n    period_start_times jsonb,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_super_master_teacher_id integer\n);",
      "CREATE SEQUENCE public.classes_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;",
      "ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);",
      "ALTER TABLE ONLY public.classes\n    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);",
      "CREATE INDEX classes_super_master_idx ON public.classes USING btree (fk_super_master_teacher_id);",
      "CREATE INDEX idx_classes_school_session ON public.classes USING btree (fk_school_id, fk_session_id);",
      "CREATE UNIQUE INDEX idx_classes_school_session_grade_section_active_unique ON public.classes USING btree (fk_school_id, fk_session_id, grade, section) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.classes\n    ADD CONSTRAINT classes_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.classes\n    ADD CONSTRAINT classes_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.classes\n    ADD CONSTRAINT classes_fk_super_master_teacher_id_fkey FOREIGN KEY (fk_super_master_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"classes\";",
      "DROP TYPE public.\"enum_classes_status\";",
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
