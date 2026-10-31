"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.fee_import_batches (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    file_name character varying(255) NOT NULL,\n    file_hash character varying(64),\n    status character varying(20) DEFAULT 'Validated'::character varying NOT NULL,\n    total_rows integer DEFAULT 0 NOT NULL,\n    valid_rows integer DEFAULT 0 NOT NULL,\n    error_rows integer DEFAULT 0 NOT NULL,\n    duplicate_rows integer DEFAULT 0 NOT NULL,\n    imported_rows integer DEFAULT 0 NOT NULL,\n    total_amount numeric(12,2) DEFAULT 0 NOT NULL,\n    fk_uploaded_by_user_id integer,\n    committed_at timestamp with time zone,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    commit_key character varying(120),\n    CONSTRAINT fee_import_batches_counts_check CHECK (((total_rows >= 0) AND (valid_rows >= 0) AND (error_rows >= 0) AND (duplicate_rows >= 0) AND (imported_rows >= 0))),\n    CONSTRAINT fee_import_batches_status_check CHECK (((status)::text = ANY (ARRAY[('Validated'::character varying)::text, ('Committing'::character varying)::text, ('Committed'::character varying)::text, ('Discarded'::character varying)::text, ('Failed'::character varying)::text])))\n);",
      "CREATE SEQUENCE public.fee_import_batches_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_import_batches_id_seq OWNED BY public.fee_import_batches.id;",
      "ALTER TABLE ONLY public.fee_import_batches ALTER COLUMN id SET DEFAULT nextval('public.fee_import_batches_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_import_batches\n    ADD CONSTRAINT fee_import_batches_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_fee_import_batches_file_hash ON public.fee_import_batches USING btree (fk_school_id, file_hash);",
      "CREATE INDEX idx_fee_import_batches_school ON public.fee_import_batches USING btree (fk_school_id, created_at);",
      "CREATE UNIQUE INDEX uq_fee_import_batches_commit_key ON public.fee_import_batches USING btree (fk_school_id, commit_key) WHERE (commit_key IS NOT NULL);",
      "ALTER TABLE ONLY public.fee_import_batches\n    ADD CONSTRAINT fee_import_batches_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.fee_import_batches\n    ADD CONSTRAINT fee_import_batches_fk_uploaded_by_user_id_fkey FOREIGN KEY (fk_uploaded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"fee_import_batches\";",
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
