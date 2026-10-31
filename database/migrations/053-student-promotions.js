"use strict";

// Consolidated from database/migrations-archive (001-088) on 2026-10-31.
// One file per table. Statements mirror the live schema exactly (pg_dump), in foreign-key order.

const UP = [
      "CREATE TABLE public.student_promotions (\n    id integer NOT NULL,\n    fk_school_id integer NOT NULL,\n    fk_student_id integer NOT NULL,\n    fk_from_class_id integer,\n    fk_to_class_id integer NOT NULL,\n    fk_session_id integer NOT NULL,\n    promoted_on date NOT NULL,\n    fk_actor_user_id integer,\n    created_at timestamp with time zone DEFAULT now() NOT NULL,\n    updated_at timestamp with time zone DEFAULT now() NOT NULL,\n    outcome character varying(20) DEFAULT 'Promoted'::character varying NOT NULL\n);",
      "CREATE SEQUENCE public.student_promotions_id_seq\n    AS integer\n    START WITH 1\n    INCREMENT BY 1\n    NO MINVALUE\n    NO MAXVALUE\n    CACHE 1;",
      "ALTER SEQUENCE public.student_promotions_id_seq OWNED BY public.student_promotions.id;",
      "ALTER TABLE ONLY public.student_promotions ALTER COLUMN id SET DEFAULT nextval('public.student_promotions_id_seq'::regclass);",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_pkey PRIMARY KEY (id);",
      "CREATE INDEX idx_student_promotions_school_date ON public.student_promotions USING btree (fk_school_id, promoted_on);",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_actor_user_id_fkey FOREIGN KEY (fk_actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_from_class_id_fkey FOREIGN KEY (fk_from_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE SET NULL;",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_school_id_fkey FOREIGN KEY (fk_school_id) REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_session_id_fkey FOREIGN KEY (fk_session_id) REFERENCES public.academic_sessions(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_student_id_fkey FOREIGN KEY (fk_student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;",
      "ALTER TABLE ONLY public.student_promotions\n    ADD CONSTRAINT student_promotions_fk_to_class_id_fkey FOREIGN KEY (fk_to_class_id) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE RESTRICT;",
];

const DOWN = [
      "DROP TABLE public.\"student_promotions\";",
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
