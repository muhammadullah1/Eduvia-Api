"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.attendance_reminders (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    date date NOT NULL,\n    fk_teacher_user_id integer,\n    fk_sent_by_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    read_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.attendance_reminders_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.attendance_reminders_id_seq OWNED BY public.attendance_reminders.id;",
      "ALTER TABLE ONLY public.attendance_reminders ALTER COLUMN id SET DEFAULT nextval('public.attendance_reminders_id_seq'::regclass);",
      "ALTER TABLE ONLY public.attendance_reminders\n    ADD CONSTRAINT attendance_reminders_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX attendance_reminders_fk_class_id_date ON public.attendance_reminders USING btree (fk_class_id, date);",
      "ALTER TABLE ONLY public.attendance_reminders\n    ADD CONSTRAINT attendance_reminders_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.attendance_reminders\n    ADD CONSTRAINT attendance_reminders_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.attendance_reminders\n    ADD CONSTRAINT attendance_reminders_fk_sent_by_user_id_fkey FOREIGN KEY (fk_sent_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendance_reminders\n    ADD CONSTRAINT attendance_reminders_fk_teacher_user_id_fkey FOREIGN KEY (fk_teacher_user_id) REFERENCES public.users(id) ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"attendance_reminders\";",
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
