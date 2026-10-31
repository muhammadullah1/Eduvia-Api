"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_status_events (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    from_status character varying(20) NOT NULL,\n    to_status character varying(20) NOT NULL,\n    reason text NOT NULL,\n    effective_on date NOT NULL,\n    fk_actor_user_id integer,\n    fk_class_id integer,\n    fk_session_id integer,\n    final_result character varying(255),\n    academic_status character varying(255),\n    financial_status character varying(255),\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    event_type character varying(20) NOT NULL,\n    reason_category character varying(40),\n    fk_to_class_id integer,\n    outstanding_amount numeric(12,2),\n    transfer_to_school character varying(255),\n    graduation_override boolean DEFAULT false NOT NULL\n);",
      "CREATE SEQUENCE public.student_status_events_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_status_events_id_seq OWNED BY public.student_status_events.id;",
      "ALTER TABLE ONLY public.student_status_events ALTER COLUMN id SET DEFAULT nextval('public.student_status_events_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_status_events_school_date ON public.student_status_events USING btree (fk_school_id, effective_on);",
      "CREATE INDEX idx_status_events_student ON public.student_status_events USING btree (fk_student_id);",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_actor_user_id_fkey FOREIGN KEY (fk_actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_class_id_fkey FOREIGN KEY (fk_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_status_events\n    ADD CONSTRAINT student_status_events_fk_to_class_id_fkey FOREIGN KEY (fk_to_class_id) REFERENCES public.classes(id) ON DELETE SET NULL;",
];

const DOWN = [
      "DROP TABLE public.\"student_status_events\";",
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
