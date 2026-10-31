"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.fee_allocations (\n    id integer NOT NULL,\n    fk_payment_id integer NOT NULL,\n    fk_fee_month_id integer NOT NULL,\n    allocated_amount numeric(12,2) NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
      "CREATE SEQUENCE public.fee_allocations_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_allocations_id_seq OWNED BY public.fee_allocations.id;",
      "ALTER TABLE ONLY public.fee_allocations ALTER COLUMN id SET DEFAULT nextval('public.fee_allocations_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_allocations\n    ADD CONSTRAINT fee_allocations_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_fee_allocations_fee_month ON public.fee_allocations USING btree (fk_fee_month_id);",
      "CREATE UNIQUE INDEX idx_fee_allocations_payment_fee_month_unique ON public.fee_allocations USING btree (fk_payment_id, fk_fee_month_id);",
      "ALTER TABLE ONLY public.fee_allocations\n    ADD CONSTRAINT fee_allocations_fk_fee_month_id_fkey FOREIGN KEY (fk_fee_month_id) REFERENCES public.student_fee_months(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.fee_allocations\n    ADD CONSTRAINT fee_allocations_fk_payment_id_fkey FOREIGN KEY (fk_payment_id) REFERENCES public.fee_payments(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"fee_allocations\";",
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
