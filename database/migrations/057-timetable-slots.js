"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_timetable_slots_day_of_week\" AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');",
      "CREATE TABLE public.timetable_slots (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fk_teacher_id integer,\n    fk_subject_id integer NOT NULL,\n    day_of_week public.enum_timetable_slots_day_of_week NOT NULL,\n    period_index integer NOT NULL,\n    start_time time without time zone,\n    end_time time without time zone,\n    room character varying(50),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.timetable_slots_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.timetable_slots_id_seq OWNED BY public.timetable_slots.id;",
      "ALTER TABLE ONLY public.timetable_slots ALTER COLUMN id SET DEFAULT nextval('public.timetable_slots_id_seq'::regclass);",
      "ALTER TABLE ONLY public.timetable_slots\n    ADD CONSTRAINT timetable_slots_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_timetable_class_day_period_unique ON public.timetable_slots USING btree (fk_class_id, day_of_week, period_index) WHERE (archived_at IS NULL);",
      "CREATE INDEX idx_timetable_slots_school_class ON public.timetable_slots USING btree (fk_school_id, fk_class_id);",
      "CREATE UNIQUE INDEX idx_timetable_teacher_day_period_unique ON public.timetable_slots USING btree (fk_school_id, fk_teacher_id, day_of_week, period_index) WHERE ((archived_at IS NULL) AND (fk_teacher_id IS NOT NULL));",
      "ALTER TABLE ONLY public.timetable_slots\n    ADD CONSTRAINT timetable_slots_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.timetable_slots\n    ADD CONSTRAINT timetable_slots_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.timetable_slots\n    ADD CONSTRAINT timetable_slots_fk_subject_id_fkey FOREIGN KEY (fk_subject_id) REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.timetable_slots\n    ADD CONSTRAINT timetable_slots_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"timetable_slots\";",
      "DROP TYPE public.\"enum_timetable_slots_day_of_week\";",
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
