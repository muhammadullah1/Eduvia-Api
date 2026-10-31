"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.role_permissions (\n    id integer NOT NULL,\n    fk_role_id integer NOT NULL,\n    permission_key character varying(100) NOT NULL,\n    fk_granted_by_user_id integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL\n);",
      "CREATE SEQUENCE public.role_permissions_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;",
      "ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);",
      "ALTER TABLE ONLY public.role_permissions\n    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_role_permissions_permission_key ON public.role_permissions USING btree (permission_key);",
      "CREATE UNIQUE INDEX uq_role_permissions_role_key ON public.role_permissions USING btree (fk_role_id, permission_key);",
      "ALTER TABLE ONLY public.role_permissions\n    ADD CONSTRAINT role_permissions_fk_granted_by_user_id_fkey FOREIGN KEY (fk_granted_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.role_permissions\n    ADD CONSTRAINT role_permissions_fk_role_id_fkey FOREIGN KEY (fk_role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.role_permissions\n    ADD CONSTRAINT role_permissions_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"role_permissions\";",
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
