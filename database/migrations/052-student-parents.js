"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_student_parents_relationship_type\" AS ENUM ('Father', 'Mother', 'Guardian');",
      "CREATE TABLE public.student_parents (\n    id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_parent_id integer NOT NULL,\n    relationship_type public.enum_student_parents_relationship_type DEFAULT 'Guardian'::public.enum_student_parents_relationship_type NOT NULL,\n    is_primary boolean DEFAULT false NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
      "CREATE SEQUENCE public.student_parents_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_parents_id_seq OWNED BY public.student_parents.id;",
      "ALTER TABLE ONLY public.student_parents ALTER COLUMN id SET DEFAULT nextval('public.student_parents_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_parents\n    ADD CONSTRAINT student_parents_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_student_parents_parent ON public.student_parents USING btree (fk_parent_id);",
      "CREATE UNIQUE INDEX idx_student_parents_student_parent_unique ON public.student_parents USING btree (fk_student_id, fk_parent_id);",
      "ALTER TABLE ONLY public.student_parents\n    ADD CONSTRAINT student_parents_fk_parent_id_fkey FOREIGN KEY (fk_parent_id) REFERENCES public.parents(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_parents\n    ADD CONSTRAINT student_parents_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_parents\";",
      "DROP TYPE public.\"enum_student_parents_relationship_type\";",
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
