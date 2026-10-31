"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_fee_concession_fee_types (\n    id integer NOT NULL,\n    fk_concession_id integer NOT NULL,\n    fee_type character varying(20) NOT NULL,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE SEQUENCE public.student_fee_concession_fee_types_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_fee_concession_fee_types_id_seq OWNED BY public.student_fee_concession_fee_types.id;",
      "ALTER TABLE ONLY public.student_fee_concession_fee_types ALTER COLUMN id SET DEFAULT nextval('public.student_fee_concession_fee_types_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_fee_concession_fee_types\n    ADD CONSTRAINT student_fee_concession_fee_types_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX uq_concession_fee_types ON public.student_fee_concession_fee_types USING btree (fk_concession_id, fee_type);",
      "ALTER TABLE ONLY public.student_fee_concession_fee_types\n    ADD CONSTRAINT student_fee_concession_fee_types_fk_concession_id_fkey FOREIGN KEY (fk_concession_id) REFERENCES public.student_fee_concessions(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_fee_concession_fee_types\";",
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
