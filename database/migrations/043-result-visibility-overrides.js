"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.result_visibility_overrides (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_exam_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_granted_by_user_id integer NOT NULL,\n    reason text NOT NULL,\n    granted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    revoked_at timestamp with time zone,\n    fk_revoked_by_user_id integer\n);",
      "CREATE SEQUENCE public.result_visibility_overrides_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.result_visibility_overrides_id_seq OWNED BY public.result_visibility_overrides.id;",
      "ALTER TABLE ONLY public.result_visibility_overrides ALTER COLUMN id SET DEFAULT nextval('public.result_visibility_overrides_id_seq'::regclass);",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_result_vis_overrides_active_unique ON public.result_visibility_overrides USING btree (fk_exam_id, fk_student_id) WHERE ((revoked_at IS NULL) AND (archived_at IS NULL));",
      "CREATE INDEX idx_result_vis_overrides_school_student ON public.result_visibility_overrides USING btree (fk_school_id, fk_student_id);",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_fk_exam_id_fkey FOREIGN KEY (fk_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_fk_granted_by_user_id_fkey FOREIGN KEY (fk_granted_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_fk_revoked_by_user_id_fkey FOREIGN KEY (fk_revoked_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.result_visibility_overrides\n    ADD CONSTRAINT result_visibility_overrides_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"result_visibility_overrides\";",
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
