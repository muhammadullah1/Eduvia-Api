"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_fee_month_adjustments (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_fee_month_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    delta_collectible numeric(12,2) NOT NULL,\n    reason text NOT NULL,\n    status character varying(30) DEFAULT 'PendingApproval'::character varying NOT NULL,\n    fk_requested_by_user_id integer,\n    fk_approved_by_user_id integer,\n    approved_at timestamp with time zone,\n    rejection_reason text,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    CONSTRAINT student_fee_month_adjustments_delta_check CHECK ((delta_collectible <> (0)::numeric)),\n    CONSTRAINT student_fee_month_adjustments_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'PendingApproval'::character varying, 'Approved'::character varying, 'Rejected'::character varying, 'Voided'::character varying])::text[])))\n);",
      "CREATE SEQUENCE public.student_fee_month_adjustments_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_fee_month_adjustments_id_seq OWNED BY public.student_fee_month_adjustments.id;",
      "ALTER TABLE ONLY public.student_fee_month_adjustments ALTER COLUMN id SET DEFAULT nextval('public.student_fee_month_adjustments_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_fee_month_adjustments_month ON public.student_fee_month_adjustments USING btree (fk_fee_month_id, status);",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_fk_approved_by_user_id_fkey FOREIGN KEY (fk_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_fk_fee_month_id_fkey FOREIGN KEY (fk_fee_month_id) REFERENCES public.student_fee_months(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_fk_requested_by_user_id_fkey FOREIGN KEY (fk_requested_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_fee_month_adjustments\n    ADD CONSTRAINT student_fee_month_adjustments_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_fee_month_adjustments\";",
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
