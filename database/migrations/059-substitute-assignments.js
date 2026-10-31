"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_substitute_assignments_status\" AS ENUM ('Assigned', 'Completed', 'Cancelled');",
      "CREATE TABLE public.substitute_assignments (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_absence_id integer NOT NULL,\n    fk_timetable_slot_id integer,\n    fk_substitute_teacher_id integer NOT NULL,\n    date date NOT NULL,\n    period_index integer NOT NULL,\n    status public.enum_substitute_assignments_status DEFAULT 'Assigned'::public.enum_substitute_assignments_status NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_class_id integer,\n    fk_subject_id integer,\n    fk_original_teacher_id integer,\n    fk_authorized_by_user_id integer,\n    notes text\n);",
      "CREATE SEQUENCE public.substitute_assignments_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.substitute_assignments_id_seq OWNED BY public.substitute_assignments.id;",
      "ALTER TABLE ONLY public.substitute_assignments ALTER COLUMN id SET DEFAULT nextval('public.substitute_assignments_id_seq'::regclass);",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_substitute_assignments_school_date ON public.substitute_assignments USING btree (fk_school_id, date);",
      "CREATE UNIQUE INDEX idx_substitute_teacher_date_period_unique ON public.substitute_assignments USING btree (fk_substitute_teacher_id, date, period_index) WHERE (archived_at IS NULL);",
      "CREATE UNIQUE INDEX substitute_assignments_one_per_absence ON public.substitute_assignments USING btree (fk_absence_id) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_absence_id_fkey FOREIGN KEY (fk_absence_id) REFERENCES public.teacher_absences(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_authorized_by_user_id_fkey FOREIGN KEY (fk_authorized_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_original_teacher_id_fkey FOREIGN KEY (fk_original_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_substitute_teacher_id_fkey FOREIGN KEY (fk_substitute_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.substitute_assignments\n    ADD CONSTRAINT substitute_assignments_fk_timetable_slot_id_fkey FOREIGN KEY (fk_timetable_slot_id) REFERENCES public.timetable_slots(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"substitute_assignments\";",
      "DROP TYPE public.\"enum_substitute_assignments_status\";",
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
