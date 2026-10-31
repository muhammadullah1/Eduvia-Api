"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_fee_concession_events (\n    id integer NOT NULL,\n    fk_concession_id integer NOT NULL,\n    event_type character varying(40) NOT NULL,\n    from_status character varying(30),\n    to_status character varying(30),\n    fk_actor_user_id integer,\n    payload jsonb,\n    created_at timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE SEQUENCE public.student_fee_concession_events_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_fee_concession_events_id_seq OWNED BY public.student_fee_concession_events.id;",
      "ALTER TABLE ONLY public.student_fee_concession_events ALTER COLUMN id SET DEFAULT nextval('public.student_fee_concession_events_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_fee_concession_events\n    ADD CONSTRAINT student_fee_concession_events_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_concession_events_concession ON public.student_fee_concession_events USING btree (fk_concession_id, created_at DESC);",
      "ALTER TABLE ONLY public.student_fee_concession_events\n    ADD CONSTRAINT student_fee_concession_events_fk_actor_user_id_fkey FOREIGN KEY (fk_actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_fee_concession_events\n    ADD CONSTRAINT student_fee_concession_events_fk_concession_id_fkey FOREIGN KEY (fk_concession_id) REFERENCES public.student_fee_concessions(id) ON UPDATE CASCADE ON DELETE CASCADE;",
];

const DOWN = [
      "DROP TABLE public.\"student_fee_concession_events\";",
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
