"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.attendance_changes (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_attendance_id integer,\n    fk_student_id integer NOT NULL,\n    fk_class_id integer,\n    date date NOT NULL,\n    from_status character varying(20),\n    to_status character varying(20) NOT NULL,\n    reason text,\n    source character varying(20) DEFAULT 'review'::character varying NOT NULL,\n    fk_actor_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE SEQUENCE public.attendance_changes_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.attendance_changes_id_seq OWNED BY public.attendance_changes.id;",
      "ALTER TABLE ONLY public.attendance_changes ALTER COLUMN id SET DEFAULT nextval('public.attendance_changes_id_seq'::regclass);",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_pkey PRIMARY KEY (id);",
      "CREATE INDEX attendance_changes_fk_school_id_created_at ON public.attendance_changes USING btree (fk_school_id, created_at);",
      "CREATE INDEX attendance_changes_fk_student_id_date ON public.attendance_changes USING btree (fk_student_id, date);",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_fk_actor_user_id_fkey FOREIGN KEY (fk_actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_fk_attendance_id_fkey FOREIGN KEY (fk_attendance_id) REFERENCES public.attendances(id) ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.attendance_changes\n    ADD CONSTRAINT attendance_changes_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"attendance_changes\";",
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
