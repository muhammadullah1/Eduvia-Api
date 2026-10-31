"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.families (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    display_name character varying(150) NOT NULL,\n    fk_primary_parent_id integer,\n    verified_at timestamp with time zone,\n    fk_verified_by_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.families_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.families_id_seq OWNED BY public.families.id;",
      "ALTER TABLE ONLY public.families ALTER COLUMN id SET DEFAULT nextval('public.families_id_seq'::regclass);",
      "ALTER TABLE ONLY public.families\n    ADD CONSTRAINT families_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_families_school ON public.families USING btree (fk_school_id) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.families\n    ADD CONSTRAINT families_fk_primary_parent_id_fkey FOREIGN KEY (fk_primary_parent_id) REFERENCES public.parents(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.families\n    ADD CONSTRAINT families_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.families\n    ADD CONSTRAINT families_fk_verified_by_user_id_fkey FOREIGN KEY (fk_verified_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"families\";",
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
