"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.audit_logs (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_user_id integer,\n    action character varying(100) NOT NULL,\n    entity_type character varying(100),\n    entity_id integer,\n    old_values jsonb,\n    new_values jsonb,\n    ip_address character varying(50),\n    user_agent character varying(500),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    actor_label character varying(255),\n    metadata jsonb\n);",
      "CREATE SEQUENCE public.audit_logs_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;",
      "ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);",
      "ALTER TABLE ONLY public.audit_logs\n    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_audit_logs_school_entity ON public.audit_logs USING btree (fk_school_id, entity_type, entity_id);",
      "CREATE INDEX idx_audit_logs_user_created_at ON public.audit_logs USING btree (fk_user_id, created_at);",
      "ALTER TABLE ONLY public.audit_logs\n    ADD CONSTRAINT audit_logs_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.audit_logs\n    ADD CONSTRAINT audit_logs_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"audit_logs\";",
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
