"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_student_fee_months_fee_type\" AS ENUM ('Tuition', 'Admission', 'Exam', 'Annual', 'Transport', 'Other', 'Promotion');",
      "CREATE TYPE public.\"enum_student_fee_months_status\" AS ENUM ('Unpaid', 'Partially Paid', 'Paid', 'Advance');",
      "CREATE TABLE public.student_fee_months (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    month character varying(7) NOT NULL,\n    fee_type public.enum_student_fee_months_fee_type DEFAULT 'Tuition'::public.enum_student_fee_months_fee_type NOT NULL,\n    base_amount numeric(12,2) NOT NULL,\n    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,\n    net_amount numeric(12,2) NOT NULL,\n    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,\n    status public.enum_student_fee_months_status DEFAULT 'Unpaid'::public.enum_student_fee_months_status NOT NULL,\n    due_date date,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    adjustment_total numeric(12,2) DEFAULT 0 NOT NULL,\n    collectible_amount numeric(12,2) NOT NULL,\n    concession_snapshot jsonb,\n    CONSTRAINT student_fee_months_collectible_nonneg CHECK ((collectible_amount >= (0)::numeric))\n);",
      "CREATE SEQUENCE public.student_fee_months_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_fee_months_id_seq OWNED BY public.student_fee_months.id;",
      "ALTER TABLE ONLY public.student_fee_months ALTER COLUMN id SET DEFAULT nextval('public.student_fee_months_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_fee_months\n    ADD CONSTRAINT student_fee_months_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_fee_months_school_month_status ON public.student_fee_months USING btree (fk_school_id, month, status);",
      "CREATE UNIQUE INDEX idx_fee_months_student_month_type_unique ON public.student_fee_months USING btree (fk_student_id, month, fee_type);",
      "ALTER TABLE ONLY public.student_fee_months\n    ADD CONSTRAINT student_fee_months_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_fee_months\n    ADD CONSTRAINT student_fee_months_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_fee_months\";",
      "DROP TYPE public.\"enum_student_fee_months_fee_type\";",
      "DROP TYPE public.\"enum_student_fee_months_status\";",
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
