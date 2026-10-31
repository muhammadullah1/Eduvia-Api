"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.locations (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    name character varying(120) NOT NULL,\n    location_code character varying(40),\n    location_type character varying(40),\n    description text,\n    capacity integer DEFAULT 1 NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.locations_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;",
      "ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);",
      "ALTER TABLE ONLY public.locations\n    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX idx_locations_session_code_active_unique ON public.locations USING btree (fk_school_id, fk_session_id, lower((location_code)::text)) WHERE ((archived_at IS NULL) AND (location_code IS NOT NULL) AND (btrim((location_code)::text) <> ''::text));",
      "CREATE UNIQUE INDEX idx_locations_session_name_active_unique ON public.locations USING btree (fk_school_id, fk_session_id, lower((name)::text)) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.locations\n    ADD CONSTRAINT locations_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.locations\n    ADD CONSTRAINT locations_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"locations\";",
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
