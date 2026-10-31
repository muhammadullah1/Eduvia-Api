"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_credit_ledger (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    entry_type character varying(20) NOT NULL,\n    amount numeric(12,2) NOT NULL,\n    source character varying(30) DEFAULT 'payment'::character varying NOT NULL,\n    fk_payment_id integer,\n    fk_fee_month_id integer,\n    notes text,\n    fk_created_by_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    CONSTRAINT student_credit_ledger_amount_check CHECK ((amount > (0)::numeric)),\n    CONSTRAINT student_credit_ledger_entry_type_check CHECK (((entry_type)::text = ANY (ARRAY[('Credit'::character varying)::text, ('Applied'::character varying)::text, ('Reversal'::character varying)::text]))),\n    CONSTRAINT student_credit_ledger_source_check CHECK (((source)::text = ANY (ARRAY[('payment'::character varying)::text, ('backfill'::character varying)::text, ('import'::character varying)::text, ('manual'::character varying)::text])))\n);",
      "CREATE SEQUENCE public.student_credit_ledger_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_credit_ledger_id_seq OWNED BY public.student_credit_ledger.id;",
      "ALTER TABLE ONLY public.student_credit_ledger ALTER COLUMN id SET DEFAULT nextval('public.student_credit_ledger_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_credit_ledger_student ON public.student_credit_ledger USING btree (fk_school_id, fk_student_id);",
      "CREATE UNIQUE INDEX uq_credit_ledger_backfill_payment ON public.student_credit_ledger USING btree (fk_payment_id) WHERE ((source)::text = 'backfill'::text);",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_fk_created_by_user_id_fkey FOREIGN KEY (fk_created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_fk_fee_month_id_fkey FOREIGN KEY (fk_fee_month_id) REFERENCES public.student_fee_months(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_fk_payment_id_fkey FOREIGN KEY (fk_payment_id) REFERENCES public.fee_payments(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_credit_ledger\n    ADD CONSTRAINT student_credit_ledger_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_credit_ledger\";",
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
