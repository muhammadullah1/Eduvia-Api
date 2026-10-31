"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_application_documents_status\" AS ENUM ('Pending', 'Uploaded', 'Verified', 'Rejected');",
      "CREATE TABLE public.application_documents (\n    id integer NOT NULL,\n    fk_application_id integer NOT NULL,\n    title character varying(255) NOT NULL,\n    file_url character varying(500),\n    document_type character varying(100),\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    status public.enum_application_documents_status DEFAULT 'Pending'::public.enum_application_documents_status NOT NULL\n);",
      "CREATE SEQUENCE public.application_documents_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.application_documents_id_seq OWNED BY public.application_documents.id;",
      "ALTER TABLE ONLY public.application_documents ALTER COLUMN id SET DEFAULT nextval('public.application_documents_id_seq'::regclass);",
      "ALTER TABLE ONLY public.application_documents\n    ADD CONSTRAINT application_documents_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX application_documents_application_title_unique ON public.application_documents USING btree (fk_application_id, title);",
      "CREATE INDEX idx_application_docs_application ON public.application_documents USING btree (fk_application_id);",
      "ALTER TABLE ONLY public.application_documents\n    ADD CONSTRAINT application_documents_fk_application_id_fkey FOREIGN KEY (fk_application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"application_documents\";",
      "DROP TYPE public.\"enum_application_documents_status\";",
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
