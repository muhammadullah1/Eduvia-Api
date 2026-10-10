"use strict";

/**
 * Aligns the applied 001–036 schema with the addendum contract the services
 * already follow. Old migrations are left untouched because they have run.
 *
 * Data already in the database is remapped, not dropped:
 * - attendance Excused → Leave
 * - application Inquiry/Applied → New, review-stage rows → Review, Approved → decision Admit
 * - mark sheet Approved → Verified
 * - fee month Partial → Partially Paid
 * - user blocked → block, inactive → in_active
 * - teacher absence Approved-with-substitute → Covered, otherwise Pending; Rejected → Cancelled
 * - the column-shaped school_settings row becomes key/value JSON
 */

async function replaceEnum(query, { table, column, values, mapping = {}, defaultValue }) {
  const type = `enum_${table}_${column}`;
  await query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
  await query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE VARCHAR(64) USING "${column}"::text`);
  await query(`DROP TYPE IF EXISTS "${type}"`);
  for (const [from, to] of Object.entries(mapping)) {
    await query(`UPDATE "${table}" SET "${column}" = '${to}' WHERE "${column}" = '${from}'`);
  }
  await query(`CREATE TYPE "${type}" AS ENUM (${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`);
  await query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "${type}" USING "${column}"::"${type}"`);
  if (defaultValue) {
    await query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue.replace(/'/g, "''")}'`);
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    await qi.sequelize.transaction(async (transaction) => {
      const q = (sql) => qi.sequelize.query(sql, { transaction });
      const t = { transaction };
      const fk = (table, { allowNull = true, onDelete = "SET NULL" } = {}) => ({
        type: Sequelize.INTEGER,
        allowNull,
        references: { model: table, key: "id" },
        onUpdate: "CASCADE",
        onDelete,
      });

      await replaceEnum(q, {
        table: "users",
        column: "status",
        values: ["active", "in_active", "pending", "block"],
        mapping: { inactive: "in_active", blocked: "block" },
        defaultValue: "active",
      });

      await replaceEnum(q, {
        table: "students",
        column: "status",
        values: ["Active", "Pending", "Inactive", "Graduated", "StruckOff", "Withdrawn"],
        defaultValue: "Active",
      });

      await replaceEnum(q, {
        table: "attendances",
        column: "status",
        values: ["Present", "Absent", "Leave"],
        mapping: { Excused: "Leave" },
      });

      await qi.addColumn("applications", "fk_class_id", fk("classes", { onDelete: "SET NULL" }), t);
      await qi.addColumn("applications", "decision", { type: Sequelize.STRING(20), allowNull: true }, t);
      await qi.addColumn("applications", "address", { type: Sequelize.TEXT, allowNull: true }, t);
      await qi.addColumn("applications", "previous_school", { type: Sequelize.STRING(255), allowNull: true }, t);
      await qi.addColumn("applications", "previous_class", { type: Sequelize.STRING(100), allowNull: true }, t);
      await qi.addColumn("applications", "guardian_relation", { type: Sequelize.STRING(50), allowNull: true }, t);
      await qi.addColumn("applications", "guardian_address", { type: Sequelize.TEXT, allowNull: true }, t);
      await qi.addColumn("applications", "interview_type", { type: Sequelize.STRING(50), allowNull: true }, t);
      await qi.addColumn("applications", "interview_date", { type: Sequelize.DATEONLY, allowNull: true }, t);
      await qi.addColumn("applications", "interview_score", { type: Sequelize.STRING(20), allowNull: true }, t);
      await qi.addColumn("applications", "interview_result", { type: Sequelize.STRING(50), allowNull: true }, t);
      await qi.addColumn("applications", "submitted_on", { type: Sequelize.DATEONLY, allowNull: true }, t);
      await q(`UPDATE applications SET decision = 'Admit' WHERE status = 'Approved' AND decision IS NULL`);
      await replaceEnum(q, {
        table: "applications",
        column: "status",
        values: ["New", "Review", "Waitlist", "Enrolled", "Rejected"],
        mapping: {
          Inquiry: "New",
          Applied: "New",
          UnderReview: "Review",
          InterviewScheduled: "Review",
          Approved: "Review",
        },
        defaultValue: "New",
      });

      await q(`DROP INDEX IF EXISTS idx_teacher_absences_teacher_date_unique`);
      await qi.addColumn("teacher_absences", "period_index", { type: Sequelize.INTEGER, allowNull: true }, t);
      await qi.addColumn("teacher_absences", "fk_class_id", fk("classes"), t);
      await qi.addColumn("teacher_absences", "fk_subject_id", fk("subjects"), t);
      await qi.addColumn("teacher_absences", "fk_timetable_slot_id", fk("timetable_slots"), t);
      await qi.addColumn("teacher_absences", "fk_marked_by_user_id", fk("users"), t);
      await q(`UPDATE teacher_absences a
               SET period_index = s.period_index,
                   fk_timetable_slot_id = s.fk_timetable_slot_id
               FROM substitute_assignments s
               WHERE s.fk_absence_id = a.id AND a.period_index IS NULL`);
      await q(`UPDATE teacher_absences a
               SET fk_class_id = slot.fk_class_id,
                   fk_subject_id = slot.fk_subject_id
               FROM timetable_slots slot
               WHERE slot.id = a.fk_timetable_slot_id`);
      await q(`UPDATE teacher_absences SET period_index = 1 WHERE period_index IS NULL`);
      await q(`UPDATE teacher_absences SET fk_marked_by_user_id = fk_approved_by_user_id
               WHERE fk_marked_by_user_id IS NULL AND fk_approved_by_user_id IS NOT NULL`);
      await q(`ALTER TABLE teacher_absences ALTER COLUMN period_index SET NOT NULL`);
      await q(`ALTER TABLE teacher_absences ALTER COLUMN status DROP DEFAULT`);
      await q(`ALTER TABLE teacher_absences ALTER COLUMN status TYPE VARCHAR(32) USING status::text`);
      await q(`DROP TYPE IF EXISTS "enum_teacher_absences_status"`);
      await q(`UPDATE teacher_absences SET status = 'Covered'
               WHERE status = 'Approved' AND id IN (
                 SELECT fk_absence_id FROM substitute_assignments WHERE archived_at IS NULL
               )`);
      await q(`UPDATE teacher_absences SET status = 'Pending' WHERE status = 'Approved'`);
      await q(`UPDATE teacher_absences SET status = 'Cancelled' WHERE status = 'Rejected'`);
      await q(`CREATE TYPE "enum_teacher_absences_status" AS ENUM ('Pending', 'Covered', 'Cancelled', 'NoClass')`);
      await q(`ALTER TABLE teacher_absences ALTER COLUMN status TYPE "enum_teacher_absences_status" USING status::"enum_teacher_absences_status"`);
      await q(`ALTER TABLE teacher_absences ALTER COLUMN status SET DEFAULT 'Pending'`);
      await q(`CREATE UNIQUE INDEX teacher_absences_teacher_period
               ON teacher_absences (fk_teacher_id, date, period_index) WHERE archived_at IS NULL`);

      await qi.addColumn("substitute_assignments", "fk_class_id", fk("classes", { allowNull: true }), t);
      await qi.addColumn("substitute_assignments", "fk_subject_id", fk("subjects"), t);
      await qi.addColumn("substitute_assignments", "fk_original_teacher_id", fk("teachers", { allowNull: true, onDelete: "CASCADE" }), t);
      await qi.addColumn("substitute_assignments", "fk_authorized_by_user_id", fk("users"), t);
      await qi.addColumn("substitute_assignments", "notes", { type: Sequelize.TEXT, allowNull: true }, t);
      await q(`UPDATE substitute_assignments s
               SET fk_class_id = slot.fk_class_id,
                   fk_subject_id = slot.fk_subject_id,
                   fk_original_teacher_id = a.fk_teacher_id
               FROM timetable_slots slot, teacher_absences a
               WHERE slot.id = s.fk_timetable_slot_id AND a.id = s.fk_absence_id`);
      await q(`ALTER TABLE substitute_assignments ALTER COLUMN fk_timetable_slot_id DROP NOT NULL`);
      await q(`CREATE UNIQUE INDEX substitute_assignments_one_per_absence
               ON substitute_assignments (fk_absence_id) WHERE archived_at IS NULL`);

      await qi.addColumn("daily_lessons", "classwork", { type: Sequelize.TEXT, allowNull: true }, t);
      await qi.addColumn("daily_lessons", "review_status", {
        type: Sequelize.ENUM("Submitted", "Approved", "Rejected"),
        allowNull: false,
        defaultValue: "Submitted",
      }, t);
      await qi.addColumn("daily_lessons", "fk_submitted_by_user_id", fk("users"), t);
      await qi.addColumn("daily_lessons", "fk_reviewed_by_user_id", fk("users"), t);
      await qi.addColumn("daily_lessons", "reviewed_at", { type: Sequelize.DATE, allowNull: true }, t);
      await qi.addColumn("daily_lessons", "review_note", { type: Sequelize.TEXT, allowNull: true }, t);

      await qi.addColumn("daily_tests", "fk_schedule_id", fk("daily_test_schedules"), t);
      await qi.addColumn("daily_tests", "month", { type: Sequelize.STRING(7), allowNull: true }, t);
      await qi.addColumn("daily_tests", "week_of_month", { type: Sequelize.INTEGER, allowNull: true }, t);
      await qi.addColumn("daily_tests", "published_at", { type: Sequelize.DATE, allowNull: true }, t);
      await qi.addColumn("daily_tests", "fk_published_by_user_id", fk("users"), t);
      await q(`ALTER TABLE daily_tests ALTER COLUMN fk_teacher_id DROP NOT NULL`);
      await q(`UPDATE daily_tests SET month = to_char(date, 'YYYY-MM'),
                 week_of_month = ((EXTRACT(DAY FROM date)::int - 1) / 7) + 1
               WHERE month IS NULL`);
      await q(`ALTER TABLE daily_tests ALTER COLUMN month SET NOT NULL`);
      await qi.addColumn("daily_tests", "status", {
        type: Sequelize.ENUM("Scheduled", "MarksEntered", "Published"),
        allowNull: false,
        defaultValue: "Scheduled",
      }, t);
      await q(`UPDATE daily_tests t SET status = 'MarksEntered'
               WHERE EXISTS (
                 SELECT 1 FROM daily_test_results r
                 WHERE r.fk_daily_test_id = t.id AND r.archived_at IS NULL AND r.obtained_marks IS NOT NULL
               )`);
      await q(`CREATE UNIQUE INDEX daily_tests_class_subject_date
               ON daily_tests (fk_class_id, fk_subject_id, date) WHERE archived_at IS NULL`);
      await qi.addColumn("daily_test_results", "fk_entered_by_user_id", fk("users"), t);

      await qi.addColumn("monthly_student_summaries", "fk_class_id", fk("classes", { allowNull: true, onDelete: "CASCADE" }), t);
      await qi.addColumn("monthly_student_summaries", "fk_subject_id", fk("subjects", { allowNull: true, onDelete: "CASCADE" }), t);
      await qi.addColumn("monthly_student_summaries", "tests_scheduled", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("monthly_student_summaries", "tests_taken", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("monthly_student_summaries", "passed_count", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("monthly_student_summaries", "failed_count", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, t);
      await qi.addColumn("monthly_student_summaries", "status", { type: Sequelize.STRING(20), allowNull: true }, t);
      await qi.addColumn("monthly_student_summaries", "flagged_for_follow_up", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, t);
      await q(`CREATE UNIQUE INDEX monthly_student_summaries_subject_month
               ON monthly_student_summaries (fk_student_id, fk_class_id, fk_subject_id, month)
               WHERE fk_class_id IS NOT NULL AND fk_subject_id IS NOT NULL AND archived_at IS NULL`);

      await qi.addColumn("exams", "fk_class_id", fk("classes", { allowNull: true, onDelete: "RESTRICT" }), t);
      await q(`UPDATE exams e SET fk_class_id = picked.class_id
               FROM (
                 SELECT fk_exam_id, MIN(fk_class_id) AS class_id
                 FROM exam_classes GROUP BY fk_exam_id
               ) picked
               WHERE picked.fk_exam_id = e.id AND e.fk_class_id IS NULL`);
      await q(`ALTER TABLE exams ALTER COLUMN fk_class_id SET NOT NULL`);

      await qi.addColumn("mark_sheets", "fk_school_id", fk("schools", { allowNull: true, onDelete: "RESTRICT" }), t);
      await qi.addColumn("mark_sheets", "fk_teacher_id", fk("teachers"), t);
      await qi.addColumn("mark_sheets", "published_at", { type: Sequelize.DATE, allowNull: true }, t);
      await qi.addColumn("mark_sheets", "fk_published_by_user_id", fk("users"), t);
      await q(`UPDATE mark_sheets m SET fk_school_id = e.fk_school_id FROM exams e WHERE e.id = m.fk_exam_id`);
      await q(`ALTER TABLE mark_sheets ALTER COLUMN fk_school_id SET NOT NULL`);
      await replaceEnum(q, {
        table: "mark_sheets",
        column: "status",
        values: ["Draft", "Submitted", "Verified", "Published"],
        mapping: { Approved: "Verified" },
        defaultValue: "Draft",
      });

      await replaceEnum(q, {
        table: "student_fee_months",
        column: "status",
        values: ["Unpaid", "Partially Paid", "Paid", "Advance"],
        mapping: { Partial: "Partially Paid" },
        defaultValue: "Unpaid",
      });

      await qi.addColumn("fee_payments", "status", {
        type: Sequelize.ENUM("Paid", "Pending"),
        allowNull: false,
        defaultValue: "Paid",
      }, t);
      await qi.addColumn("fee_payments", "allocation_mode", {
        type: Sequelize.ENUM("auto", "manual"),
        allowNull: false,
        defaultValue: "auto",
      }, t);
      await qi.addColumn("fee_payments", "period", { type: Sequelize.STRING(255), allowNull: true }, t);

      await qi.addColumn("audit_logs", "actor_label", { type: Sequelize.STRING(255), allowNull: true }, t);
      await qi.addColumn("audit_logs", "metadata", { type: Sequelize.JSONB, allowNull: true }, t);
      await q(`ALTER TABLE audit_logs ALTER COLUMN entity_type DROP NOT NULL`);
      await q(`UPDATE audit_logs SET metadata = new_values WHERE metadata IS NULL AND new_values IS NOT NULL`);

      await q(`ALTER TABLE school_settings RENAME TO school_settings_legacy`);
      await qi.createTable("school_settings", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        fk_school_id: fk("schools", { allowNull: false, onDelete: "CASCADE" }),
        key: { type: Sequelize.STRING(64), allowNull: false },
        value: { type: Sequelize.JSONB, allowNull: false },
        fk_updated_by_user_id: fk("users"),
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        archived_at: { type: Sequelize.DATE, allowNull: true },
      }, t);
      await q(`INSERT INTO school_settings (fk_school_id, key, value, created_at, updated_at)
               SELECT fk_school_id, 'fees',
                      jsonb_build_object('dueDay', COALESCE(tuition_fee_due_day, 10)),
                      created_at, updated_at
               FROM school_settings_legacy WHERE archived_at IS NULL`);
      await q(`INSERT INTO school_settings (fk_school_id, key, value, created_at, updated_at)
               SELECT fk_school_id, 'admission',
                      jsonb_build_object(
                        'prefix', COALESCE(admission_number_prefix, 'CLS'),
                        'digits', COALESCE(admission_number_digits, 4)
                      ),
                      created_at, updated_at
               FROM school_settings_legacy WHERE archived_at IS NULL`);
      await q(`INSERT INTO school_settings (fk_school_id, key, value, created_at, updated_at)
               SELECT fk_school_id, 'schoolProfile',
                      jsonb_build_object(
                        'currency', currency,
                        'timezone', timezone,
                        'academicYearStartMonth', academic_year_start_month,
                        'lateFeeFineAmount', late_fee_fine_amount,
                        'lateFeeGraceDays', late_fee_grace_days
                      ),
                      created_at, updated_at
               FROM school_settings_legacy WHERE archived_at IS NULL`);
      await q(`CREATE UNIQUE INDEX school_settings_unique_key
               ON school_settings (fk_school_id, key) WHERE archived_at IS NULL`);
      await qi.dropTable("school_settings_legacy", t);
    });
  },

  async down(queryInterface, Sequelize) {
    const qi = queryInterface;
    await qi.sequelize.transaction(async (transaction) => {
      const q = (sql) => qi.sequelize.query(sql, { transaction });
      const t = { transaction };

      await qi.createTable("school_settings_legacy", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        fk_school_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "schools", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        admission_number_prefix: { type: Sequelize.STRING(20), allowNull: true, defaultValue: "CLS" },
        admission_number_digits: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 4 },
        academic_year_start_month: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 4 },
        currency: { type: Sequelize.STRING(10), allowNull: true, defaultValue: "PKR" },
        tuition_fee_due_day: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 10 },
        late_fee_fine_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
        late_fee_grace_days: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 5 },
        timezone: { type: Sequelize.STRING(50), allowNull: true, defaultValue: "Asia/Karachi" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        archived_at: { type: Sequelize.DATE, allowNull: true },
      }, t);
      await q(`INSERT INTO school_settings_legacy (
                 fk_school_id, admission_number_prefix, admission_number_digits, tuition_fee_due_day,
                 currency, timezone, academic_year_start_month, late_fee_fine_amount, late_fee_grace_days,
                 created_at, updated_at
               )
               SELECT s.fk_school_id,
                      COALESCE(a.value->>'prefix', 'CLS'),
                      COALESCE((a.value->>'digits')::int, 4),
                      COALESCE((f.value->>'dueDay')::int, 10),
                      p.value->>'currency',
                      p.value->>'timezone',
                      (p.value->>'academicYearStartMonth')::int,
                      (p.value->>'lateFeeFineAmount')::numeric,
                      (p.value->>'lateFeeGraceDays')::int,
                      NOW(), NOW()
               FROM (SELECT DISTINCT fk_school_id FROM school_settings) s
               LEFT JOIN school_settings a ON a.fk_school_id = s.fk_school_id AND a.key = 'admission'
               LEFT JOIN school_settings f ON f.fk_school_id = s.fk_school_id AND f.key = 'fees'
               LEFT JOIN school_settings p ON p.fk_school_id = s.fk_school_id AND p.key = 'schoolProfile'`);
      await qi.dropTable("school_settings", t);
      await q(`ALTER TABLE school_settings_legacy RENAME TO school_settings`);

      await q(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS actor_label`);
      await q(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS metadata`);
      await q(`UPDATE audit_logs SET entity_type = 'unknown' WHERE entity_type IS NULL`);
      await q(`ALTER TABLE audit_logs ALTER COLUMN entity_type SET NOT NULL`);

      await q(`ALTER TABLE fee_payments DROP COLUMN IF EXISTS period`);
      await q(`ALTER TABLE fee_payments DROP COLUMN IF EXISTS allocation_mode`);
      await q(`ALTER TABLE fee_payments DROP COLUMN IF EXISTS status`);
      await q(`DROP TYPE IF EXISTS "enum_fee_payments_status"`);
      await q(`DROP TYPE IF EXISTS "enum_fee_payments_allocation_mode"`);

      await replaceEnum(q, {
        table: "student_fee_months",
        column: "status",
        values: ["Unpaid", "Partial", "Paid"],
        mapping: { "Partially Paid": "Partial", Advance: "Paid" },
        defaultValue: "Unpaid",
      });

      await replaceEnum(q, {
        table: "mark_sheets",
        column: "status",
        values: ["Draft", "Submitted", "Approved", "Published"],
        mapping: { Verified: "Approved" },
        defaultValue: "Draft",
      });
      for (const column of ["fk_published_by_user_id", "published_at", "fk_teacher_id", "fk_school_id"]) {
        await qi.removeColumn("mark_sheets", column, t);
      }
      await qi.removeColumn("exams", "fk_class_id", t);

      await q(`DROP INDEX IF EXISTS monthly_student_summaries_subject_month`);
      for (const column of ["flagged_for_follow_up", "status", "failed_count", "passed_count", "tests_taken", "tests_scheduled", "fk_subject_id", "fk_class_id"]) {
        await qi.removeColumn("monthly_student_summaries", column, t);
      }

      await qi.removeColumn("daily_test_results", "fk_entered_by_user_id", t);
      await q(`DROP INDEX IF EXISTS daily_tests_class_subject_date`);
      for (const column of ["status", "fk_published_by_user_id", "published_at", "week_of_month", "month", "fk_schedule_id"]) {
        await qi.removeColumn("daily_tests", column, t);
      }
      await q(`DROP TYPE IF EXISTS "enum_daily_tests_status"`);
      await q(`UPDATE daily_tests SET fk_teacher_id = (SELECT id FROM teachers LIMIT 1) WHERE fk_teacher_id IS NULL`);
      await q(`ALTER TABLE daily_tests ALTER COLUMN fk_teacher_id SET NOT NULL`);

      for (const column of ["review_note", "reviewed_at", "fk_reviewed_by_user_id", "fk_submitted_by_user_id", "review_status", "classwork"]) {
        await qi.removeColumn("daily_lessons", column, t);
      }
      await q(`DROP TYPE IF EXISTS "enum_daily_lessons_review_status"`);

      await q(`DROP INDEX IF EXISTS substitute_assignments_one_per_absence`);
      for (const column of ["notes", "fk_authorized_by_user_id", "fk_original_teacher_id", "fk_subject_id", "fk_class_id"]) {
        await qi.removeColumn("substitute_assignments", column, t);
      }
      await q(`UPDATE substitute_assignments SET fk_timetable_slot_id = (SELECT id FROM timetable_slots LIMIT 1) WHERE fk_timetable_slot_id IS NULL`);
      await q(`ALTER TABLE substitute_assignments ALTER COLUMN fk_timetable_slot_id SET NOT NULL`);

      await q(`DROP INDEX IF EXISTS teacher_absences_teacher_period`);
      await replaceEnum(q, {
        table: "teacher_absences",
        column: "status",
        values: ["Pending", "Approved", "Rejected"],
        mapping: { Covered: "Approved", Cancelled: "Rejected", NoClass: "Pending" },
        defaultValue: "Pending",
      });
      for (const column of ["fk_marked_by_user_id", "fk_timetable_slot_id", "fk_subject_id", "fk_class_id", "period_index"]) {
        await qi.removeColumn("teacher_absences", column, t);
      }
      await q(`CREATE UNIQUE INDEX idx_teacher_absences_teacher_date_unique ON teacher_absences (fk_teacher_id, date)`);

      await replaceEnum(q, {
        table: "applications",
        column: "status",
        values: ["Inquiry", "Applied", "UnderReview", "InterviewScheduled", "Approved", "Rejected", "Enrolled"],
        mapping: { New: "Inquiry", Review: "UnderReview", Waitlist: "Applied" },
        defaultValue: "Inquiry",
      });
      for (const column of ["submitted_on", "interview_result", "interview_score", "interview_date", "interview_type", "guardian_address", "guardian_relation", "previous_class", "previous_school", "address", "decision", "fk_class_id"]) {
        await qi.removeColumn("applications", column, t);
      }

      await replaceEnum(q, {
        table: "attendances",
        column: "status",
        values: ["Present", "Absent", "Late", "Excused", "HalfDay"],
        mapping: { Leave: "Excused" },
      });

      await replaceEnum(q, {
        table: "students",
        column: "status",
        values: ["Active", "Inactive", "Graduated", "StruckOff", "Withdrawn"],
        mapping: { Pending: "Active" },
        defaultValue: "Active",
      });

      await replaceEnum(q, {
        table: "users",
        column: "status",
        values: ["active", "inactive", "pending", "blocked"],
        mapping: { in_active: "inactive", block: "blocked" },
        defaultValue: "active",
      });
    });
  },
};
