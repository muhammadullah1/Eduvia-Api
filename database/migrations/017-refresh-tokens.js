"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.refresh_tokens (\n    id integer NOT NULL,\n    fk_user_id integer NOT NULL,\n    token_hash character varying(64) NOT NULL,\n    family_id uuid NOT NULL,\n    expires_at timestamp with time zone NOT NULL,\n    revoked_at timestamp with time zone,\n    replaced_by_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    grace_used_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.refresh_tokens_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;",
      "ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);",
      "ALTER TABLE ONLY public.refresh_tokens\n    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);",
      "ALTER TABLE ONLY public.refresh_tokens\n    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);",
      "CREATE INDEX refresh_tokens_family_id ON public.refresh_tokens USING btree (family_id);",
      "CREATE INDEX refresh_tokens_fk_user_id ON public.refresh_tokens USING btree (fk_user_id);",
      "ALTER TABLE ONLY public.refresh_tokens\n    ADD CONSTRAINT refresh_tokens_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"refresh_tokens\";",
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
