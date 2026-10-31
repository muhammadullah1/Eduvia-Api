"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_teacher_absences_status\" AS ENUM ('Pending', 'Covered', 'Cancelled', 'NoClass');",
      "CREATE TABLE public.teacher_absences (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_teacher_id integer NOT NULL,\n    date date NOT NULL,\n    reason text,\n    status public.enum_teacher_absences_status DEFAULT 'Pending'::public.enum_teacher_absences_status NOT NULL,\n    fk_approved_by_user_id integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    period_index integer NOT NULL,\n    fk_class_id integer,\n    fk_subject_id integer,\n    fk_timetable_slot_id integer,\n    fk_marked_by_user_id integer\n);",
      "CREATE SEQUENCE public.teacher_absences_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.teacher_absences_id_seq OWNED BY public.teacher_absences.id;",
      "ALTER TABLE ONLY public.teacher_absences ALTER COLUMN id SET DEFAULT nextval('public.teacher_absences_id_seq'::regclass);",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_teacher_absences_school_date ON public.teacher_absences USING btree (fk_school_id, date);",
      "CREATE UNIQUE INDEX teacher_absences_teacher_period ON public.teacher_absences USING btree (fk_teacher_id, date, period_index) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_approved_by_user_id_fkey FOREIGN KEY (fk_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_marked_by_user_id_fkey FOREIGN KEY (fk_marked_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.teacher_absences\n    ADD CONSTRAINT teacher_absences_fk_timetable_slot_id_fkey FOREIGN KEY (fk_timetable_slot_id) REFERENCES public.timetable_slots(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"teacher_absences\";",
      "DROP TYPE public.\"enum_teacher_absences_status\";",
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
