"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.teacher_subject_assignments (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_teacher_id integer NOT NULL,\n    fk_subject_id integer NOT NULL,\n    effective_from date NOT NULL,\n    effective_to date,\n    fk_assigned_by_user_id integer,\n    reason text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.teacher_subject_assignments_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.teacher_subject_assignments_id_seq OWNED BY public.teacher_subject_assignments.id;",
      "ALTER TABLE ONLY public.teacher_subject_assignments ALTER COLUMN id SET DEFAULT nextval('public.teacher_subject_assignments_id_seq'::regclass);",
      "ALTER TABLE ONLY public.teacher_subject_assignments\n    ADD CONSTRAINT teacher_subject_assignments_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_teacher_subj_assign_school ON public.teacher_subject_assignments USING btree (fk_school_id);",
      "CREATE INDEX idx_teacher_subj_assign_teacher_subject ON public.teacher_subject_assignments USING btree (fk_teacher_id, fk_subject_id);",
      "ALTER TABLE ONLY public.teacher_subject_assignments\n    ADD CONSTRAINT teacher_subject_assignments_fk_assigned_by_user_id_fkey FOREIGN KEY (fk_assigned_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teacher_subject_assignments\n    ADD CONSTRAINT teacher_subject_assignments_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.teacher_subject_assignments\n    ADD CONSTRAINT teacher_subject_assignments_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.teacher_subject_assignments\n    ADD CONSTRAINT teacher_subject_assignments_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"teacher_subject_assignments\";",
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
