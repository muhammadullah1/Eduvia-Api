"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.school_concession_reasons (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    label character varying(100) NOT NULL,\n    default_mode character varying(30),\n    default_value numeric(12,2),\n    sort_order integer DEFAULT 100 NOT NULL,\n    active boolean DEFAULT true NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    requires_family boolean DEFAULT false NOT NULL,\n    CONSTRAINT school_concession_reasons_default_mode_check CHECK (((default_mode IS NULL) OR ((default_mode)::text = ANY ((ARRAY['percent'::character varying, 'fixed_discount'::character varying, 'fixed_payable'::character varying, 'waiver'::character varying])::text[]))))\n);",
      "CREATE SEQUENCE public.school_concession_reasons_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.school_concession_reasons_id_seq OWNED BY public.school_concession_reasons.id;",
      "ALTER TABLE ONLY public.school_concession_reasons ALTER COLUMN id SET DEFAULT nextval('public.school_concession_reasons_id_seq'::regclass);",
      "ALTER TABLE ONLY public.school_concession_reasons\n    ADD CONSTRAINT school_concession_reasons_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_school_concession_reasons_school_active ON public.school_concession_reasons USING btree (fk_school_id, active, sort_order);",
      "CREATE UNIQUE INDEX uq_school_concession_reasons_school_label ON public.school_concession_reasons USING btree (fk_school_id, lower((label)::text)) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.school_concession_reasons\n    ADD CONSTRAINT school_concession_reasons_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"school_concession_reasons\";",
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
