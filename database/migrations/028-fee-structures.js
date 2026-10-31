"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.fee_structures (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    fk_class_id integer NOT NULL,\n    fee_type character varying(20) NOT NULL,\n    frequency character varying(20) NOT NULL,\n    amount numeric(12,2) DEFAULT 0 NOT NULL,\n    fk_updated_by_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    archived_at timestamp with time zone,\n    effective_from date NOT NULL,\n    removed_reason text,\n    fk_removed_by_user_id integer,\n    CONSTRAINT fee_structures_amount_check CHECK ((amount >= (0)::numeric)),\n    CONSTRAINT fee_structures_fee_type_check CHECK (((fee_type)::text = ANY ((ARRAY['Tuition'::character varying, 'Admission'::character varying, 'Exam'::character varying, 'Annual'::character varying, 'Promotion'::character varying])::text[]))),\n    CONSTRAINT fee_structures_frequency_check CHECK (((frequency)::text = ANY (ARRAY[('Monthly'::character varying)::text, ('OneTime'::character varying)::text, ('Yearly'::character varying)::text])))\n);",
      "CREATE SEQUENCE public.fee_structures_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.fee_structures_id_seq OWNED BY public.fee_structures.id;",
      "ALTER TABLE ONLY public.fee_structures ALTER COLUMN id SET DEFAULT nextval('public.fee_structures_id_seq'::regclass);",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_fee_structures_lookup ON public.fee_structures USING btree (fk_class_id, fee_type, effective_from DESC);",
      "CREATE INDEX idx_fee_structures_school_session ON public.fee_structures USING btree (fk_school_id, fk_session_id);",
      "CREATE UNIQUE INDEX uq_fee_structures_class_type_effective ON public.fee_structures USING btree (fk_class_id, fee_type, effective_from) WHERE (archived_at IS NULL);",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_fk_removed_by_user_id_fkey FOREIGN KEY (fk_removed_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.fee_structures\n    ADD CONSTRAINT fee_structures_fk_updated_by_user_id_fkey FOREIGN KEY (fk_updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"fee_structures\";",
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
