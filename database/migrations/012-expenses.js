"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.expenses (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    title character varying(255) NOT NULL,\n    category character varying(100) NOT NULL,\n    amount numeric(12,2) NOT NULL,\n    expense_date date NOT NULL,\n    fk_recorded_by_user_id integer,\n    receipt_url character varying(500),\n    notes text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    payment_method character varying(20),\n    category_key character varying(20) NOT NULL,\n    archive_reason text,\n    fk_archived_by_user_id integer,\n    reference_no character varying(100),\n    CONSTRAINT expenses_category_key_check CHECK (((category_key)::text = ANY (ARRAY[('StaffSalary'::character varying)::text, ('Utilities'::character varying)::text, ('Supplies'::character varying)::text, ('Maintenance'::character varying)::text, ('Other'::character varying)::text]))),\n    CONSTRAINT expenses_payment_method_check CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY (ARRAY[('Cash'::character varying)::text, ('BankTransfer'::character varying)::text, ('Cheque'::character varying)::text, ('Online'::character varying)::text]))))\n);",
      "CREATE SEQUENCE public.expenses_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;",
      "ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);",
      "ALTER TABLE ONLY public.expenses\n    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_expenses_school_category ON public.expenses USING btree (fk_school_id, category_key);",
      "CREATE INDEX idx_expenses_school_date ON public.expenses USING btree (fk_school_id, expense_date);",
      "ALTER TABLE ONLY public.expenses\n    ADD CONSTRAINT expenses_fk_archived_by_user_id_fkey FOREIGN KEY (fk_archived_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.expenses\n    ADD CONSTRAINT expenses_fk_recorded_by_user_id_fkey FOREIGN KEY (fk_recorded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.expenses\n    ADD CONSTRAINT expenses_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"expenses\";",
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
