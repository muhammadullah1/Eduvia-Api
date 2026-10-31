"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_fee_concessions (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_family_id integer,\n    category character varying(30) DEFAULT 'Standard'::character varying NOT NULL,\n    mode character varying(30) NOT NULL,\n    value numeric(12,2) DEFAULT 0 NOT NULL,\n    priority integer DEFAULT 100 NOT NULL,\n    stackable boolean DEFAULT false NOT NULL,\n    max_discount_amount numeric(12,2),\n    effective_from date NOT NULL,\n    effective_to date,\n    status character varying(30) DEFAULT 'Draft'::character varying NOT NULL,\n    reason text,\n    fk_requested_by_user_id integer,\n    fk_approved_by_user_id integer,\n    approved_at timestamp with time zone,\n    rejection_reason text,\n    notes text,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    archived_at timestamp with time zone,\n    fee_type character varying(20) DEFAULT 'Tuition'::character varying NOT NULL,\n    fk_reason_id integer,\n    fk_replaces_id integer,\n    CONSTRAINT student_fee_concessions_category_check CHECK (((category)::text = ANY ((ARRAY['Standard'::character varying, 'Scholarship'::character varying, 'Sibling'::character varying, 'Other'::character varying])::text[]))),\n    CONSTRAINT student_fee_concessions_fee_type_check CHECK (((fee_type)::text = ANY ((ARRAY['Tuition'::character varying, 'Admission'::character varying, 'Exam'::character varying, 'Annual'::character varying, 'Promotion'::character varying])::text[]))),\n    CONSTRAINT student_fee_concessions_mode_check CHECK (((mode)::text = ANY ((ARRAY['percent'::character varying, 'fixed_discount'::character varying, 'fixed_payable'::character varying, 'waiver'::character varying])::text[]))),\n    CONSTRAINT student_fee_concessions_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'PendingApproval'::character varying, 'Approved'::character varying, 'Rejected'::character varying, 'Revoked'::character varying, 'Superseded'::character varying])::text[]))),\n    CONSTRAINT student_fee_concessions_value_check CHECK ((value >= (0)::numeric))\n);",
      "CREATE SEQUENCE public.student_fee_concessions_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_fee_concessions_id_seq OWNED BY public.student_fee_concessions.id;",
      "ALTER TABLE ONLY public.student_fee_concessions ALTER COLUMN id SET DEFAULT nextval('public.student_fee_concessions_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_concessions_school_status ON public.student_fee_concessions USING btree (fk_school_id, status);",
      "CREATE INDEX idx_concessions_student_session ON public.student_fee_concessions USING btree (fk_student_id, fk_session_id, status) WHERE (archived_at IS NULL);",
      "CREATE UNIQUE INDEX uq_concession_one_approved_per_student_type ON public.student_fee_concessions USING btree (fk_school_id, fk_student_id, fee_type) WHERE (((status)::text = 'Approved'::text) AND (archived_at IS NULL));",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_approved_by_user_id_fkey FOREIGN KEY (fk_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_family_id_fkey FOREIGN KEY (fk_family_id) REFERENCES public.families(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_reason_id_fkey FOREIGN KEY (fk_reason_id) REFERENCES public.school_concession_reasons(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_replaces_id_fkey FOREIGN KEY (fk_replaces_id) REFERENCES public.student_fee_concessions(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_requested_by_user_id_fkey FOREIGN KEY (fk_requested_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_fee_concessions\n    ADD CONSTRAINT student_fee_concessions_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_fee_concessions\";",
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
