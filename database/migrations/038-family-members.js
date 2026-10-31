"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.family_members (\n    id integer NOT NULL,\n    fk_family_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,\n    linked_via character varying(40) DEFAULT 'manual'::character varying NOT NULL,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    CONSTRAINT family_members_linked_via_check CHECK (((linked_via)::text = ANY ((ARRAY['manual'::character varying, 'shared_parent_suggestion'::character varying])::text[]))),\n    CONSTRAINT family_members_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Removed'::character varying])::text[])))\n);",
      "CREATE SEQUENCE public.family_members_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.family_members_id_seq OWNED BY public.family_members.id;",
      "ALTER TABLE ONLY public.family_members ALTER COLUMN id SET DEFAULT nextval('public.family_members_id_seq'::regclass);",
      "ALTER TABLE ONLY public.family_members\n    ADD CONSTRAINT family_members_pkey PRIMARY KEY (id);",
      "CREATE UNIQUE INDEX uq_family_members_active_student ON public.family_members USING btree (fk_student_id) WHERE ((status)::text = 'Active'::text);",
      "CREATE UNIQUE INDEX uq_family_members_family_student ON public.family_members USING btree (fk_family_id, fk_student_id);",
      "ALTER TABLE ONLY public.family_members\n    ADD CONSTRAINT family_members_fk_family_id_fkey FOREIGN KEY (fk_family_id) REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.family_members\n    ADD CONSTRAINT family_members_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"family_members\";",
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
