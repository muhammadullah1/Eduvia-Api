"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_teacher_classes_role\" AS ENUM ('ClassTeacher', 'SubjectTeacher');",
      "CREATE TABLE public.teacher_classes (\n    id integer NOT NULL,\n    fk_teacher_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    role public.enum_teacher_classes_role DEFAULT 'SubjectTeacher'::public.enum_teacher_classes_role NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.teacher_classes_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.teacher_classes_id_seq OWNED BY public.teacher_classes.id;",
      "ALTER TABLE ONLY public.teacher_classes ALTER COLUMN id SET DEFAULT nextval('public.teacher_classes_id_seq'::regclass);",
      "ALTER TABLE ONLY public.teacher_classes\n    ADD CONSTRAINT teacher_classes_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_teacher_classes_teacher_class_role_unique ON public.teacher_classes USING btree (fk_teacher_id, fk_class_id, role);",
      "ALTER TABLE ONLY public.teacher_classes\n    ADD CONSTRAINT teacher_classes_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.teacher_classes\n    ADD CONSTRAINT teacher_classes_fk_teacher_id_fkey FOREIGN KEY (fk_teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"teacher_classes\";",
      "DROP TYPE public.\"enum_teacher_classes_role\";",
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
