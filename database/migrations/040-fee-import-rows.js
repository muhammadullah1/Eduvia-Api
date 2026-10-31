"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.fee_import_rows (\n    id integer NOT NULL,\n    fk_batch_id integer NOT NULL,\n    row_number integer NOT NULL,\n    admission_no character varying(50),\n    fk_student_id integer,\n    month character varying(255),\n    amount numeric(12,2),\n    payment_date date,\n    reference_no character varying(100),\n    payment_method character varying(20),\n    status character varying(20) NOT NULL,\n    errors jsonb DEFAULT '[]'::jsonb NOT NULL,\n    raw jsonb,\n    fk_payment_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    CONSTRAINT fee_import_rows_amount_check CHECK (((amount IS NULL) OR (amount >= (0)::numeric))),\n    CONSTRAINT fee_import_rows_status_check CHECK (((status)::text = ANY (ARRAY[('Valid'::character varying)::text, ('Error'::character varying)::text, ('Duplicate'::character varying)::text, ('Imported'::character varying)::text, ('Skipped'::character varying)::text])))\n);",
      "CREATE SEQUENCE public.fee_import_rows_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_import_rows_id_seq OWNED BY public.fee_import_rows.id;",
      "ALTER TABLE ONLY public.fee_import_rows ALTER COLUMN id SET DEFAULT nextval('public.fee_import_rows_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_import_rows\n    ADD CONSTRAINT fee_import_rows_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX uq_fee_import_rows_batch_row ON public.fee_import_rows USING btree (fk_batch_id, row_number);",
      "ALTER TABLE ONLY public.fee_import_rows\n    ADD CONSTRAINT fee_import_rows_fk_batch_id_fkey FOREIGN KEY (fk_batch_id) REFERENCES public.fee_import_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.fee_import_rows\n    ADD CONSTRAINT fee_import_rows_fk_payment_id_fkey FOREIGN KEY (fk_payment_id) REFERENCES public.fee_payments(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.fee_import_rows\n    ADD CONSTRAINT fee_import_rows_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"fee_import_rows\";",
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
