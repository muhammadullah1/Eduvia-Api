"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_schools_status\" AS ENUM ('active', 'inactive', 'suspended');",
      "CREATE TABLE public.schools (\n    id integer NOT NULL,\n    name character varying(255) NOT NULL,\n    code character varying(50),\n    phone character varying(50),\n    email character varying(255) NOT NULL,\n    address text,\n    website character varying(255),\n    logo character varying(500),\n    status public.enum_schools_status DEFAULT 'active'::public.enum_schools_status NOT NULL,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.schools_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.schools_id_seq OWNED BY public.schools.id;",
      "ALTER TABLE ONLY public.schools ALTER COLUMN id SET DEFAULT nextval('public.schools_id_seq'::regclass);",
      "ALTER TABLE ONLY public.schools\n    ADD CONSTRAINT schools_code_key UNIQUE (code);",
      "ALTER TABLE ONLY public.schools\n    ADD CONSTRAINT schools_email_key UNIQUE (email);",
      "ALTER TABLE ONLY public.schools\n    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX schools_code ON public.schools USING btree (code);",
      "CREATE UNIQUE INDEX schools_email ON public.schools USING btree (email);",
];

const DOWN = [
      "DROP TABLE public.\"schools\";",
      "DROP TYPE public.\"enum_schools_status\";",
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
