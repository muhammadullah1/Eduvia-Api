"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_attendances_status\" AS ENUM ('Present', 'Absent', 'Leave', 'Late');",
      "CREATE TABLE public.attendances (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    date date NOT NULL,\n    status public.enum_attendances_status NOT NULL,\n    remarks character varying(255),\n    fk_marked_by_user_id integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    fk_created_by_user_id integer\n);",
      "CREATE SEQUENCE public.attendances_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.attendances_id_seq OWNED BY public.attendances.id;",
      "ALTER TABLE ONLY public.attendances ALTER COLUMN id SET DEFAULT nextval('public.attendances_id_seq'::regclass);",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_attendances_class_date ON public.attendances USING btree (fk_class_id, date);",
      "CREATE INDEX idx_attendances_school_date ON public.attendances USING btree (fk_school_id, date);",
      "CREATE UNIQUE INDEX idx_attendances_student_date_unique ON public.attendances USING btree (fk_student_id, date);",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_fk_created_by_user_id_fkey FOREIGN KEY (fk_created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_fk_marked_by_user_id_fkey FOREIGN KEY (fk_marked_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.attendances\n    ADD CONSTRAINT attendances_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"attendances\";",
      "DROP TYPE public.\"enum_attendances_status\";",
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
