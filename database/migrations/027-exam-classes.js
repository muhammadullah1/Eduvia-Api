"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.exam_classes (\n    id integer NOT NULL,\n    fk_exam_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
      "CREATE SEQUENCE public.exam_classes_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.exam_classes_id_seq OWNED BY public.exam_classes.id;",
      "ALTER TABLE ONLY public.exam_classes ALTER COLUMN id SET DEFAULT nextval('public.exam_classes_id_seq'::regclass);",
      "ALTER TABLE ONLY public.exam_classes\n    ADD CONSTRAINT exam_classes_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_exam_classes_exam_class_unique ON public.exam_classes USING btree (fk_exam_id, fk_class_id);",
      "ALTER TABLE ONLY public.exam_classes\n    ADD CONSTRAINT exam_classes_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.exam_classes\n    ADD CONSTRAINT exam_classes_fk_exam_id_fkey FOREIGN KEY (fk_exam_id) REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"exam_classes\";",
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
