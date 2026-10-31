"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TYPE public.\"enum_student_leave_requests_status\" AS ENUM ('Pending', 'Approved', 'Rejected');",
      "CREATE TABLE public.student_leave_requests (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_requested_by_user_id integer NOT NULL,\n    start_date date NOT NULL,\n    end_date date NOT NULL,\n    reason text NOT NULL,\n    status public.enum_student_leave_requests_status DEFAULT 'Pending'::public.enum_student_leave_requests_status NOT NULL,\n    fk_reviewed_by_user_id integer,\n    review_notes text,\n    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    archived_at timestamp with time zone\n);",
      "CREATE SEQUENCE public.student_leave_requests_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_leave_requests_id_seq OWNED BY public.student_leave_requests.id;",
      "ALTER TABLE ONLY public.student_leave_requests ALTER COLUMN id SET DEFAULT nextval('public.student_leave_requests_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_leave_requests\n    ADD CONSTRAINT student_leave_requests_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_leave_req_school_status ON public.student_leave_requests USING btree (fk_school_id, status);",
      "CREATE INDEX idx_leave_req_student_dates ON public.student_leave_requests USING btree (fk_student_id, start_date, end_date);",
      "ALTER TABLE ONLY public.student_leave_requests\n    ADD CONSTRAINT student_leave_requests_fk_requested_by_user_id_fkey FOREIGN KEY (fk_requested_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_leave_requests\n    ADD CONSTRAINT student_leave_requests_fk_reviewed_by_user_id_fkey FOREIGN KEY (fk_reviewed_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_leave_requests\n    ADD CONSTRAINT student_leave_requests_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_leave_requests\n    ADD CONSTRAINT student_leave_requests_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_leave_requests\";",
      "DROP TYPE public.\"enum_student_leave_requests_status\";",
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
