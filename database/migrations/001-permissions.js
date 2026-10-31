"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.permissions (\n    id integer NOT NULL,\n    key character varying(100) NOT NULL,\n    module character varying(50) NOT NULL,\n    action character varying(30) NOT NULL,\n    label character varying(120) NOT NULL,\n    description text NOT NULL,\n    risk character varying(10) NOT NULL,\n    assignable_roles character varying(40)[] DEFAULT (ARRAY[]::character varying[])::character varying(40)[] NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    CONSTRAINT permissions_risk_check CHECK (((risk)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[])))\n);",
      "CREATE SEQUENCE public.permissions_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;",
      "ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);",
      "ALTER TABLE ONLY public.permissions\n    ADD CONSTRAINT permissions_key_key UNIQUE (key);",
      "ALTER TABLE ONLY public.permissions\n    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);",
];

const DOWN = [
      "DROP TABLE public.\"permissions\";",
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
