"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_fee_payments_allocation_mode\" AS ENUM ('auto', 'manual');",
      "CREATE TYPE public.\"enum_fee_payments_payment_method\" AS ENUM ('Cash', 'BankTransfer', 'Cheque', 'Online');",
      "CREATE TYPE public.\"enum_fee_payments_status\" AS ENUM ('Paid', 'Pending');",
      "CREATE TABLE public.fee_payments (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    receipt_no character varying(50) NOT NULL,\n    amount_paid numeric(12,2) NOT NULL,\n    unallocated_amount numeric(12,2) DEFAULT 0 NOT NULL,\n    payment_method public.enum_fee_payments_payment_method DEFAULT 'Cash'::public.enum_fee_payments_payment_method NOT NULL,\n    payment_date date NOT NULL,\n    reference_no character varying(100),\n    idempotency_key character varying(100),\n    fk_recorded_by_user_id integer,\n    notes text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    status public.enum_fee_payments_status DEFAULT 'Paid'::public.enum_fee_payments_status NOT NULL,\n    allocation_mode public.enum_fee_payments_allocation_mode DEFAULT 'auto'::public.enum_fee_payments_allocation_mode NOT NULL,\n    period character varying(255)\n);",
      "CREATE SEQUENCE public.fee_payments_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_payments_id_seq OWNED BY public.fee_payments.id;",
      "ALTER TABLE ONLY public.fee_payments ALTER COLUMN id SET DEFAULT nextval('public.fee_payments_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_payments\n    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_fee_payments_idempotency_key_unique ON public.fee_payments USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);",
      "CREATE UNIQUE INDEX idx_fee_payments_school_receipt_no_unique ON public.fee_payments USING btree (fk_school_id, receipt_no);",
      "CREATE INDEX idx_fee_payments_student_date ON public.fee_payments USING btree (fk_student_id, payment_date);",
      "ALTER TABLE ONLY public.fee_payments\n    ADD CONSTRAINT fee_payments_fk_recorded_by_user_id_fkey FOREIGN KEY (fk_recorded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.fee_payments\n    ADD CONSTRAINT fee_payments_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.fee_payments\n    ADD CONSTRAINT fee_payments_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"fee_payments\";",
      "DROP TYPE public.\"enum_fee_payments_allocation_mode\";",
      "DROP TYPE public.\"enum_fee_payments_payment_method\";",
      "DROP TYPE public.\"enum_fee_payments_status\";",
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
