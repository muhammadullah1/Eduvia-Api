"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_block_dates_date_type\" AS ENUM ('single', 'multiple');",
      "CREATE TABLE public.block_dates (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    name character varying(120) NOT NULL,\n    date_type public.enum_block_dates_date_type DEFAULT 'single'::public.enum_block_dates_date_type NOT NULL,\n    start_date date NOT NULL,\n    end_date date NOT NULL,\n    description text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.block_dates_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.block_dates_id_seq OWNED BY public.block_dates.id;",
      "ALTER TABLE ONLY public.block_dates ALTER COLUMN id SET DEFAULT nextval('public.block_dates_id_seq'::regclass);",
      "ALTER TABLE ONLY public.block_dates\n    ADD CONSTRAINT block_dates_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_block_dates_range ON public.block_dates USING btree (start_date, end_date);",
      "CREATE INDEX idx_block_dates_school ON public.block_dates USING btree (fk_school_id);",
      "ALTER TABLE ONLY public.block_dates\n    ADD CONSTRAINT block_dates_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"block_dates\";",
      "DROP TYPE public.\"enum_block_dates_date_type\";",
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
