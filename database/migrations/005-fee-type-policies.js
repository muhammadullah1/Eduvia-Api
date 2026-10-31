"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.fee_type_policies (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fee_type character varying(20) NOT NULL,\n    concession_eligible boolean DEFAULT true NOT NULL,\n    active boolean DEFAULT true NOT NULL,\n    label character varying(100),\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.fee_type_policies_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_type_policies_id_seq OWNED BY public.fee_type_policies.id;",
      "ALTER TABLE ONLY public.fee_type_policies ALTER COLUMN id SET DEFAULT nextval('public.fee_type_policies_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_type_policies\n    ADD CONSTRAINT fee_type_policies_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX uq_fee_type_policies_school_type ON public.fee_type_policies USING btree (fk_school_id, fee_type) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.fee_type_policies\n    ADD CONSTRAINT fee_type_policies_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"fee_type_policies\";",
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
