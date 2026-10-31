"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.mark_sheet_rows (\n    id integer NOT NULL,\n    fk_mark_sheet_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    obtained_marks numeric(5,2),\n    is_absent boolean DEFAULT false NOT NULL,\n    remarks character varying(255),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    is_exempt boolean DEFAULT false NOT NULL\n);",
      "CREATE SEQUENCE public.mark_sheet_rows_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.mark_sheet_rows_id_seq OWNED BY public.mark_sheet_rows.id;",
      "ALTER TABLE ONLY public.mark_sheet_rows ALTER COLUMN id SET DEFAULT nextval('public.mark_sheet_rows_id_seq'::regclass);",
      "ALTER TABLE ONLY public.mark_sheet_rows\n    ADD CONSTRAINT mark_sheet_rows_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_mark_sheet_rows_sheet_student_unique ON public.mark_sheet_rows USING btree (fk_mark_sheet_id, fk_student_id);",
      "CREATE INDEX idx_mark_sheet_rows_student ON public.mark_sheet_rows USING btree (fk_student_id);",
      "ALTER TABLE ONLY public.mark_sheet_rows\n    ADD CONSTRAINT mark_sheet_rows_fk_mark_sheet_id_fkey FOREIGN KEY (fk_mark_sheet_id) REFERENCES public.mark_sheets(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.mark_sheet_rows\n    ADD CONSTRAINT mark_sheet_rows_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"mark_sheet_rows\";",
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
