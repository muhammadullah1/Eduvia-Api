"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.parents (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_user_id integer,\n    father_name character varying(100),\n    mother_name character varying(100),\n    primary_contact_number character varying(50),\n    occupation character varying(100),\n    cnic character varying(50),\n    address text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone,\n    guardian_name character varying(100)\n);",
      "CREATE SEQUENCE public.parents_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.parents_id_seq OWNED BY public.parents.id;",
      "ALTER TABLE ONLY public.parents ALTER COLUMN id SET DEFAULT nextval('public.parents_id_seq'::regclass);",
      "ALTER TABLE ONLY public.parents\n    ADD CONSTRAINT parents_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_parents_school_cnic ON public.parents USING btree (fk_school_id, cnic);",
      "CREATE UNIQUE INDEX idx_parents_user_unique ON public.parents USING btree (fk_user_id);",
      "ALTER TABLE ONLY public.parents\n    ADD CONSTRAINT parents_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.parents\n    ADD CONSTRAINT parents_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"parents\";",
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
