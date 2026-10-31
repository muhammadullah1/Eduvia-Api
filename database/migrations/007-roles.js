"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.roles (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    key character varying(40) NOT NULL,\n    label character varying(80) NOT NULL,\n    description character varying(255),\n    portal character varying(20) NOT NULL,\n    is_system boolean DEFAULT true NOT NULL,\n    version integer DEFAULT 1 NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    CONSTRAINT roles_portal_check CHECK (((portal)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'parent'::character varying])::text[]))),\n    CONSTRAINT roles_version_check CHECK ((version >= 1))\n);",
      "CREATE SEQUENCE public.roles_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;",
      "ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);",
      "ALTER TABLE ONLY public.roles\n    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX uq_roles_school_key ON public.roles USING btree (fk_school_id, key);",
      "ALTER TABLE ONLY public.roles\n    ADD CONSTRAINT roles_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"roles\";",
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
