"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_users_gender\" AS ENUM ('Male', 'Female', 'Other');",
      "CREATE TYPE public.\"enum_users_role\" AS ENUM ('super_admin', 'operations_manager', 'accountant', 'teacher', 'parent');",
      "CREATE TYPE public.\"enum_users_status\" AS ENUM ('active', 'in_active', 'pending', 'block');",
      "CREATE TABLE public.users (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    first_name character varying(100) NOT NULL,\n    last_name character varying(100) NOT NULL,\n    email character varying(255) NOT NULL,\n    phone character varying(50),\n    password character varying(255),\n    gender public.enum_users_gender,\n    role public.enum_users_role NOT NULL,\n    status public.enum_users_status DEFAULT 'active'::public.enum_users_status NOT NULL,\n    date_of_birth date,\n    photo character varying(500),\n    last_login timestamp with time zone,\n    archived_by integer,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.users_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;",
      "ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);",
      "ALTER TABLE ONLY public.users\n    ADD CONSTRAINT users_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_users_email ON public.users USING btree (email);",
      "CREATE UNIQUE INDEX idx_users_school_email_unique ON public.users USING btree (fk_school_id, email);",
      "CREATE INDEX idx_users_school_role ON public.users USING btree (fk_school_id, role);",
      "ALTER TABLE ONLY public.users\n    ADD CONSTRAINT users_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.users\n    ADD CONSTRAINT users_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"users\";",
      "DROP TYPE public.\"enum_users_gender\";",
      "DROP TYPE public.\"enum_users_role\";",
      "DROP TYPE public.\"enum_users_status\";",
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
