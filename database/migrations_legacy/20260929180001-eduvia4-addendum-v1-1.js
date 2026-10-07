"use strict";

/**
 * EDUVIA-4 — SRS Addendum v1.1 (28 Sep 2026).
 *
 * - UR-01  roles: super_admin / operations_manager / accountant / teacher / parent
 * - UR-02  one active teacher subject + assignment history (teacher_subjects join retired)
 * - UR-03  per-period absences + substitute_assignments, timetable clash indexes
 * - UR-04  planned_chapters + daily-update review workflow
 * - UR-05/06 weekly daily_test_schedules; monthly summaries derived from weekly tests
 *          (standalone monthly_tests retired); configurable rules in school_settings
 * - UR-07  exams entity, publication vs parent visibility, audited overrides
 * - UR-08/09 student_fee_months + fee_allocations, recorded_by, idempotency
 * - audit_logs gains entity + metadata columns
 */

const ARCHIVE = "archived_at IS NULL";

function timestamps(S) {
  return {
    created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
    updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
    archived_at: { type: S.DATE, allowNull: true },
  };
}

function fk(S, table, { allowNull = false, onDelete = "CASCADE" } = {}) {
  return {
    type: S.INTEGER,
    allowNull,
    references: { model: table, key: "id" },
    onUpdate: "CASCADE",
    onDelete,
  };
}

const pk = (S) => ({ id: { type: S.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false } });

/** Swap a Postgres enum column to a new value set, remapping old values. */
async function replaceEnum(q, { table, column, values, mapping = {}, defaultValue }) {
  const type = `enum_${table}_${column}`;
  await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
  await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE VARCHAR(64) USING "${column}"::text`);
  await q(`DROP TYPE IF EXISTS "${type}"`);
  for (const [from, to] of Object.entries(mapping)) {
    await q(`UPDATE "${table}" SET "${column}" = '${to}' WHERE "${column}" = '${from}'`);
  }
  await q(`CREATE TYPE "${type}" AS ENUM (${values.map((v) => `'${v}'`).join(", ")})`);
  await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "${type}" USING "${column}"::"${type}"`);
  if (defaultValue) await q(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'`);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, S) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const qi = queryInterface;
      const q = (sql) => qi.sequelize.query(sql, { transaction });
      const t = { transaction };

      // ---- UR-01 roles -------------------------------------------------------
      await replaceEnum(q, {
        table: "users",
        column: "role",
        values: ["super_admin", "operations_manager", "accountant", "teacher", "parent"],
        mapping: { management: "super_admin", controller: "operations_manager" },
      });

      // ---- audit trail metadata --------------------------------------------
      await qi.addColumn("audit_logs", "entity_type", { type: S.STRING(64), allowNull: true }, t);
      await qi.addColumn("audit_logs", "entity_id", { type: S.INTEGER, allowNull: true }, t);
      await qi.addColumn("audit_logs", "metadata", { type: S.JSONB, allowNull: true }, t);
      await qi.addIndex("audit_logs", ["fk_school_id", "entity_type", "entity_id"], { ...t, name: "audit_logs_entity" });

      // ---- configurable rules ----------------------------------------------
      await qi.createTable("school_settings", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        key: { type: S.STRING(64), allowNull: false },
        value: { type: S.JSONB, allowNull: false },
        fk_updated_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        ...timestamps(S),
      }, t);
      await qi.addIndex("school_settings", ["fk_school_id", "key"], { ...t, unique: true, name: "school_settings_unique_key" });

      await qi.addColumn("classes", "monthly_fee", { type: S.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, t);

      // ---- UR-02 teacher subject + history ---------------------------------
      await qi.renameColumn("teachers", "fk_primary_subject_id", "fk_subject_id", t);
      await q(`UPDATE teachers t SET fk_subject_id = ts.fk_subject_id
               FROM (SELECT DISTINCT ON (fk_teacher_id) fk_teacher_id, fk_subject_id
                     FROM teacher_subjects ORDER BY fk_teacher_id, id) ts
               WHERE t.fk_subject_id IS NULL AND ts.fk_teacher_id = t.id`);
      await qi.createTable("teacher_subject_assignments", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_teacher_id: fk(S, "teachers"),
        fk_subject_id: fk(S, "subjects", { onDelete: "RESTRICT" }),
        effective_from: { type: S.DATEONLY, allowNull: false },
        effective_to: { type: S.DATEONLY, allowNull: true },
        fk_assigned_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        reason: { type: S.TEXT, allowNull: true },
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX teacher_subject_assignments_one_active
               ON teacher_subject_assignments (fk_teacher_id) WHERE effective_to IS NULL AND ${ARCHIVE}`);
      await q(`INSERT INTO teacher_subject_assignments (fk_school_id, fk_teacher_id, fk_subject_id, effective_from, reason)
               SELECT fk_school_id, id, fk_subject_id, CURRENT_DATE, 'Backfilled from primary subject'
               FROM teachers WHERE fk_subject_id IS NOT NULL AND ${ARCHIVE}`);
      await qi.dropTable("teacher_subjects", t);

      // ---- UR-03 timetable clashes, absences, substitutes -------------------
      await q(`CREATE UNIQUE INDEX timetable_slots_class_period
               ON timetable_slots (fk_class_id, day, period_index) WHERE ${ARCHIVE}`);
      await q(`CREATE UNIQUE INDEX timetable_slots_teacher_period
               ON timetable_slots (fk_teacher_id, day, period_index) WHERE fk_teacher_id IS NOT NULL AND ${ARCHIVE}`);

      await qi.createTable("substitute_assignments", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_absence_id: fk(S, "teacher_absences"),
        fk_timetable_slot_id: fk(S, "timetable_slots", { allowNull: true, onDelete: "SET NULL" }),
        date: { type: S.DATEONLY, allowNull: false },
        period_index: { type: S.INTEGER, allowNull: false },
        fk_class_id: fk(S, "classes"),
        fk_subject_id: fk(S, "subjects", { allowNull: true, onDelete: "SET NULL" }),
        fk_original_teacher_id: fk(S, "teachers"),
        fk_substitute_teacher_id: fk(S, "teachers"),
        fk_authorized_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        notes: { type: S.TEXT, allowNull: true },
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX substitute_assignments_one_per_absence
               ON substitute_assignments (fk_absence_id) WHERE ${ARCHIVE}`);
      await q(`CREATE UNIQUE INDEX substitute_assignments_substitute_period
               ON substitute_assignments (fk_substitute_teacher_id, date, period_index) WHERE ${ARCHIVE}`);
      await q(`INSERT INTO substitute_assignments (fk_school_id, fk_absence_id, fk_timetable_slot_id, date, period_index,
                 fk_class_id, fk_original_teacher_id, fk_substitute_teacher_id, notes)
               SELECT fk_school_id, id, fk_timetable_slot_id, date, period_index, fk_class_id, fk_teacher_id,
                 fk_cover_teacher_id, notes
               FROM teacher_absences
               WHERE fk_cover_teacher_id IS NOT NULL AND fk_cover_teacher_id <> fk_teacher_id AND ${ARCHIVE}`);
      await q(`UPDATE teacher_absences SET status = 'Absent'
               WHERE status = 'Covered' AND id NOT IN (SELECT fk_absence_id FROM substitute_assignments)`);

      await qi.removeIndex("teacher_absences", "teacher_absences_unique_period", t);
      await qi.removeColumn("teacher_absences", "fk_cover_teacher_id", t);
      await qi.changeColumn("teacher_absences", "fk_class_id", fk(S, "classes", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("teacher_absences", "fk_subject_id", fk(S, "subjects", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("teacher_absences", "fk_marked_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await replaceEnum(q, {
        table: "teacher_absences",
        column: "status",
        values: ["Pending", "Covered", "Cancelled", "NoClass"],
        mapping: { Absent: "Pending", Unmanaged: "Pending" },
        defaultValue: "Pending",
      });
      await q(`CREATE UNIQUE INDEX teacher_absences_teacher_period
               ON teacher_absences (fk_teacher_id, date, period_index) WHERE ${ARCHIVE}`);

      // ---- UR-04 planned chapters + reviewed daily updates -----------------
      await qi.createTable("planned_chapters", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_class_id: fk(S, "classes"),
        fk_subject_id: fk(S, "subjects"),
        sequence: { type: S.INTEGER, allowNull: false },
        title: { type: S.STRING, allowNull: false },
        description: { type: S.TEXT, allowNull: true },
        target_date: { type: S.DATEONLY, allowNull: true },
        fk_created_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX planned_chapters_sequence
               ON planned_chapters (fk_class_id, fk_subject_id, sequence) WHERE ${ARCHIVE}`);

      await qi.renameColumn("daily_lessons", "notes", "remarks", t);
      await qi.addColumn("daily_lessons", "fk_planned_chapter_id", fk(S, "planned_chapters", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("daily_lessons", "classwork", { type: S.TEXT, allowNull: true }, t);
      await qi.addColumn("daily_lessons", "homework", { type: S.TEXT, allowNull: true }, t);
      await qi.addColumn("daily_lessons", "review_status", {
        type: S.ENUM("Submitted", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Submitted",
      }, t);
      await qi.addColumn("daily_lessons", "fk_submitted_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("daily_lessons", "fk_reviewed_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("daily_lessons", "reviewed_at", { type: S.DATE, allowNull: true }, t);
      await qi.addColumn("daily_lessons", "review_note", { type: S.TEXT, allowNull: true }, t);

      // ---- UR-05/06 weekly subject tests -----------------------------------
      await qi.createTable("daily_test_schedules", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_class_id: fk(S, "classes"),
        fk_subject_id: fk(S, "subjects"),
        weekday: { type: S.STRING(12), allowNull: false },
        period_index: { type: S.INTEGER, allowNull: true },
        max_score: { type: S.INTEGER, allowNull: false, defaultValue: 20 },
        is_active: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
        fk_created_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX daily_test_schedules_one_per_subject
               ON daily_test_schedules (fk_class_id, fk_subject_id) WHERE is_active AND ${ARCHIVE}`);

      await qi.addColumn("daily_tests", "fk_schedule_id", fk(S, "daily_test_schedules", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("daily_tests", "month", { type: S.STRING(7), allowNull: true }, t);
      await qi.addColumn("daily_tests", "week_of_month", { type: S.INTEGER, allowNull: true }, t);
      await qi.addColumn("daily_tests", "status", {
        type: S.ENUM("Scheduled", "MarksEntered", "Published"),
        allowNull: false,
        defaultValue: "Scheduled",
      }, t);
      await qi.addColumn("daily_tests", "published_at", { type: S.DATE, allowNull: true }, t);
      await qi.addColumn("daily_tests", "fk_published_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await q(`UPDATE daily_tests SET month = to_char(date, 'YYYY-MM'),
                 week_of_month = ((EXTRACT(DAY FROM date)::int - 1) / 7) + 1`);
      await qi.changeColumn("daily_tests", "month", { type: S.STRING(7), allowNull: false }, t);
      await q(`CREATE UNIQUE INDEX daily_tests_class_subject_date
               ON daily_tests (fk_class_id, fk_subject_id, date) WHERE ${ARCHIVE}`);
      await qi.addColumn("daily_test_results", "fk_entered_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);

      await qi.dropTable("monthly_test_results", t);
      await qi.dropTable("monthly_tests", t);
      await qi.addColumn("monthly_student_summaries", "tests_scheduled", { type: S.INTEGER, allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("monthly_student_summaries", "flagged_for_follow_up", { type: S.BOOLEAN, allowNull: false, defaultValue: false }, t);
      await q(`DELETE FROM monthly_student_summaries WHERE fk_subject_id IS NULL`);
      await qi.changeColumn("monthly_student_summaries", "fk_subject_id", fk(S, "subjects"), t);

      // ---- UR-07 exams, publication, parent visibility ---------------------
      await qi.createTable("exams", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_session_id: fk(S, "academic_sessions", { allowNull: true, onDelete: "SET NULL" }),
        fk_class_id: fk(S, "classes"),
        name: { type: S.STRING, allowNull: false },
        fee_month: { type: S.STRING(7), allowNull: true },
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX exams_class_name ON exams (fk_class_id, name) WHERE ${ARCHIVE}`);
      await q(`INSERT INTO exams (fk_school_id, fk_class_id, name, fee_month)
               SELECT DISTINCT ON (fk_class_id, exam_name) fk_school_id, fk_class_id, exam_name,
                 NULLIF(fee_period, '')
               FROM mark_sheets WHERE ${ARCHIVE} ORDER BY fk_class_id, exam_name, id`);
      await qi.addColumn("mark_sheets", "fk_exam_id", fk(S, "exams", { allowNull: true }), t);
      await q(`UPDATE mark_sheets m SET fk_exam_id = e.id FROM exams e
               WHERE e.fk_class_id = m.fk_class_id AND e.name = m.exam_name`);
      await q(`DELETE FROM mark_sheets WHERE fk_exam_id IS NULL`);
      await qi.changeColumn("mark_sheets", "fk_exam_id", fk(S, "exams"), t);
      await qi.addColumn("mark_sheets", "fk_teacher_id", fk(S, "teachers", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("mark_sheets", "published_at", { type: S.DATE, allowNull: true }, t);
      await qi.addColumn("mark_sheets", "fk_published_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.removeColumn("mark_sheets", "fee_period", t);
      for (const column of ["blocked_by_fee", "manual_override", "override_reason", "override_by_user_id", "visible_to_parent"]) {
        await qi.removeColumn("mark_sheet_rows", column, t);
      }

      await qi.createTable("result_visibility_overrides", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_exam_id: fk(S, "exams"),
        fk_student_id: fk(S, "students"),
        reason: { type: S.TEXT, allowNull: false },
        fk_granted_by_user_id: fk(S, "users", { onDelete: "RESTRICT" }),
        granted_at: { type: S.DATE, allowNull: false },
        revoked_at: { type: S.DATE, allowNull: true },
        fk_revoked_by_user_id: fk(S, "users", { allowNull: true, onDelete: "SET NULL" }),
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX result_visibility_overrides_active
               ON result_visibility_overrides (fk_exam_id, fk_student_id) WHERE revoked_at IS NULL AND ${ARCHIVE}`);

      // ---- UR-08/09 monthly fee ledger + allocations ------------------------
      await qi.createTable("student_fee_months", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_student_id: fk(S, "students"),
        month: { type: S.DATEONLY, allowNull: false },
        fee_type: { type: S.STRING(64), allowNull: false, defaultValue: "Tuition" },
        amount_due: { type: S.DECIMAL(12, 2), allowNull: false },
        amount_paid: { type: S.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        status: {
          type: S.ENUM("Unpaid", "Partially Paid", "Paid", "Advance"),
          allowNull: false,
          defaultValue: "Unpaid",
        },
        due_date: { type: S.DATEONLY, allowNull: true },
        ...timestamps(S),
      }, t);
      await q(`CREATE UNIQUE INDEX student_fee_months_unique
               ON student_fee_months (fk_student_id, month, fee_type) WHERE ${ARCHIVE}`);
      await qi.addIndex("student_fee_months", ["fk_school_id", "status"], { ...t, name: "student_fee_months_status" });

      await qi.changeColumn("fee_payments", "period", { type: S.STRING, allowNull: true }, t);
      await qi.addColumn("fee_payments", "fk_recorded_by_user_id", fk(S, "users", { allowNull: true, onDelete: "SET NULL" }), t);
      await qi.addColumn("fee_payments", "idempotency_key", { type: S.STRING(128), allowNull: true, unique: true }, t);
      await qi.addColumn("fee_payments", "unallocated_amount", { type: S.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("fee_payments", "allocation_mode", {
        type: S.ENUM("auto", "manual"),
        allowNull: false,
        defaultValue: "auto",
      }, t);
      await qi.addIndex("fee_payments", ["fk_recorded_by_user_id", "paid_on"], { ...t, name: "fee_payments_recorder_day" });

      await qi.createTable("fee_allocations", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_payment_id: fk(S, "fee_payments"),
        fk_fee_month_id: fk(S, "student_fee_months", { onDelete: "RESTRICT" }),
        amount: { type: S.DECIMAL(12, 2), allowNull: false },
        ...timestamps(S),
      }, t);
      await qi.addIndex("fee_allocations", ["fk_payment_id", "fk_fee_month_id"], { ...t, unique: true, name: "fee_allocations_unique" });
    });
  },

  async down(queryInterface, S) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const qi = queryInterface;
      const q = (sql) => qi.sequelize.query(sql, { transaction });
      const t = { transaction };

      await qi.dropTable("fee_allocations", t);
      await qi.removeIndex("fee_payments", "fee_payments_recorder_day", t);
      for (const column of ["fk_recorded_by_user_id", "idempotency_key", "unallocated_amount", "allocation_mode"]) {
        await qi.removeColumn("fee_payments", column, t);
      }
      await q(`DROP TYPE IF EXISTS "enum_fee_payments_allocation_mode"`);
      await q(`UPDATE fee_payments SET period = '' WHERE period IS NULL`);
      await qi.changeColumn("fee_payments", "period", { type: S.STRING, allowNull: false }, t);
      await qi.dropTable("student_fee_months", t);
      await q(`DROP TYPE IF EXISTS "enum_student_fee_months_status"`);

      await qi.dropTable("result_visibility_overrides", t);
      await qi.addColumn("mark_sheet_rows", "blocked_by_fee", { type: S.BOOLEAN, allowNull: false, defaultValue: false }, t);
      await qi.addColumn("mark_sheet_rows", "manual_override", { type: S.BOOLEAN, allowNull: false, defaultValue: false }, t);
      await qi.addColumn("mark_sheet_rows", "override_reason", { type: S.TEXT, allowNull: true }, t);
      await qi.addColumn("mark_sheet_rows", "override_by_user_id", { type: S.INTEGER, allowNull: true }, t);
      await qi.addColumn("mark_sheet_rows", "visible_to_parent", { type: S.BOOLEAN, allowNull: false, defaultValue: false }, t);
      await qi.addColumn("mark_sheets", "fee_period", { type: S.STRING, allowNull: true }, t);
      await q(`UPDATE mark_sheets m SET fee_period = e.fee_month FROM exams e WHERE e.id = m.fk_exam_id`);
      for (const column of ["fk_exam_id", "fk_teacher_id", "published_at", "fk_published_by_user_id"]) {
        await qi.removeColumn("mark_sheets", column, t);
      }
      await qi.dropTable("exams", t);

      await qi.changeColumn("monthly_student_summaries", "fk_subject_id", fk(S, "subjects", { allowNull: true }), t);
      await qi.removeColumn("monthly_student_summaries", "flagged_for_follow_up", t);
      await qi.removeColumn("monthly_student_summaries", "tests_scheduled", t);
      await qi.createTable("monthly_tests", {
        ...pk(S),
        fk_school_id: fk(S, "schools"),
        fk_class_id: fk(S, "classes"),
        fk_subject_id: fk(S, "subjects", { allowNull: true, onDelete: "SET NULL" }),
        month: { type: S.STRING(7), allowNull: false },
        title: { type: S.STRING, allowNull: false },
        max_score: { type: S.INTEGER, allowNull: false, defaultValue: 100 },
        date: { type: S.DATEONLY, allowNull: true },
        ...timestamps(S),
      }, t);
      await qi.createTable("monthly_test_results", {
        ...pk(S),
        fk_monthly_test_id: fk(S, "monthly_tests"),
        fk_student_id: fk(S, "students"),
        score: { type: S.DECIMAL(6, 2), allowNull: true },
        ...timestamps(S),
      }, t);

      await qi.removeColumn("daily_test_results", "fk_entered_by_user_id", t);
      await q(`DROP INDEX IF EXISTS daily_tests_class_subject_date`);
      for (const column of ["fk_schedule_id", "month", "week_of_month", "status", "published_at", "fk_published_by_user_id"]) {
        await qi.removeColumn("daily_tests", column, t);
      }
      await q(`DROP TYPE IF EXISTS "enum_daily_tests_status"`);
      await qi.dropTable("daily_test_schedules", t);

      for (const column of ["fk_planned_chapter_id", "classwork", "homework", "review_status", "fk_submitted_by_user_id",
        "fk_reviewed_by_user_id", "reviewed_at", "review_note"]) {
        await qi.removeColumn("daily_lessons", column, t);
      }
      await q(`DROP TYPE IF EXISTS "enum_daily_lessons_review_status"`);
      await qi.renameColumn("daily_lessons", "remarks", "notes", t);
      await qi.dropTable("planned_chapters", t);

      await q(`DROP INDEX IF EXISTS teacher_absences_teacher_period`);
      await replaceEnum(q, {
        table: "teacher_absences",
        column: "status",
        values: ["Absent", "Covered", "Cancelled", "Unmanaged"],
        mapping: { Pending: "Absent", NoClass: "Unmanaged" },
        defaultValue: "Absent",
      });
      await qi.addColumn("teacher_absences", "fk_cover_teacher_id", fk(S, "teachers", { allowNull: true, onDelete: "SET NULL" }), t);
      await q(`UPDATE teacher_absences a SET fk_cover_teacher_id = s.fk_substitute_teacher_id
               FROM substitute_assignments s WHERE s.fk_absence_id = a.id AND s.archived_at IS NULL`);
      await qi.removeColumn("teacher_absences", "fk_marked_by_user_id", t);
      await qi.removeColumn("teacher_absences", "fk_subject_id", t);
      await q(`DELETE FROM teacher_absences WHERE fk_class_id IS NULL`);
      await qi.changeColumn("teacher_absences", "fk_class_id", fk(S, "classes"), t);
      await qi.addIndex("teacher_absences", ["fk_teacher_id", "date", "period_index", "fk_class_id"], {
        ...t, unique: true, name: "teacher_absences_unique_period",
      });
      await qi.dropTable("substitute_assignments", t);
      await q(`DROP INDEX IF EXISTS timetable_slots_class_period`);
      await q(`DROP INDEX IF EXISTS timetable_slots_teacher_period`);

      await qi.createTable("teacher_subjects", {
        ...pk(S),
        fk_teacher_id: fk(S, "teachers"),
        fk_subject_id: fk(S, "subjects"),
        created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
        updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") },
      }, t);
      await qi.addIndex("teacher_subjects", ["fk_teacher_id", "fk_subject_id"], {
        ...t, unique: true, name: "teacher_subjects_unique",
      });
      await q(`INSERT INTO teacher_subjects (fk_teacher_id, fk_subject_id)
               SELECT id, fk_subject_id FROM teachers WHERE fk_subject_id IS NOT NULL`);
      await qi.dropTable("teacher_subject_assignments", t);
      await qi.renameColumn("teachers", "fk_subject_id", "fk_primary_subject_id", t);

      await qi.removeColumn("classes", "monthly_fee", t);
      await qi.dropTable("school_settings", t);
      await qi.removeIndex("audit_logs", "audit_logs_entity", t);
      for (const column of ["entity_type", "entity_id", "metadata"]) await qi.removeColumn("audit_logs", column, t);

      await replaceEnum(q, {
        table: "users",
        column: "role",
        values: ["management", "controller", "accountant", "teacher", "parent"],
        mapping: { super_admin: "management", operations_manager: "controller" },
      });
    });
  },
};
