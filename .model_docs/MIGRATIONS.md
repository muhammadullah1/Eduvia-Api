# Migrations

`database/migrations` holds **60 files, numbered `001`–`060` with no gaps, one per table**, in
foreign-key order: each table comes after the tables it references. A fresh database ends with 60
rows in `SequelizeMeta`. Never edit an applied migration; add `061-…` and so on after the last one.

Every file follows the style of `001-create-schools.js`. It uses the `queryInterface` API only:
`createTable` with `Sequelize` data types, foreign keys as `references` on the column, `ENUM`s
via `Sequelize.ENUM`, then `addIndex` and `addConstraint`. Partial and expression indexes and
CHECK constraints are written with `where` objects (`Op`, `Sequelize.fn`, `Sequelize.col`), not SQL
strings. `down` drops the table. The only raw SQL is the `DROP TYPE IF EXISTS "enum_…"` line in
`down` for tables that have enums, exactly as in `001`; `queryInterface` has no portable call for it.

| File | Table | Previous file |
| --- | --- | --- |
| `001-create-schools` | schools | `001-create-schools` |
| `002-create-academic-sessions` | academic_sessions | `002-create-academic-sessions` |
| `003-create-users` | users | `003-create-users` |
| `004-create-school-settings` | school_settings | `004-create-school-settings` |
| `005-create-subjects` | subjects | `005-create-subjects` |
| `006-create-teachers` | teachers | `006-create-teachers` |
| `007-create-teacher-subject-assignments` | teacher_subject_assignments | `007-create-teacher-subject-assignments` |
| `008-create-classes` | classes | `008-create-classes` |
| `009-create-class-subjects` | class_subjects | `009-create-class-subjects` |
| `010-create-teacher-classes` | teacher_classes | `010-create-teacher-classes` |
| `011-create-timetable-slots` | timetable_slots | `011-create-timetable-slots` |
| `012-create-teacher-absences` | teacher_absences | `012-create-teacher-absences` |
| `013-create-substitute-assignments` | substitute_assignments | `013-create-substitute-assignments` |
| `014-create-students` | students | `014-create-students` |
| `015-create-parents` | parents | `015-create-parents` |
| `016-create-student-parents` | student_parents | `016-create-student-parents` |
| `017-create-student-leave-requests` | student_leave_requests | `017-create-student-leave-requests` |
| `018-create-attendances` | attendances | `018-create-attendances` |
| `019-create-applications` | applications | `019-create-applications` |
| `020-create-application-documents` | application_documents | `020-create-application-documents` |
| `021-create-planned-chapters` | planned_chapters | `021-create-planned-chapters` |
| `022-create-daily-lessons` | daily_lessons | `022-create-daily-lessons` |
| `023-create-daily-test-schedules` | daily_test_schedules | `023-create-daily-test-schedules` |
| `024-create-daily-tests` | daily_tests | `024-create-daily-tests` |
| `025-create-daily-test-results` | daily_test_results | `025-create-daily-test-results` |
| `026-create-monthly-student-summaries` | monthly_student_summaries | `026-create-monthly-student-summaries` |
| `027-create-exams` | exams | `027-create-exams` |
| `028-create-exam-classes` | exam_classes | `028-create-exam-classes` |
| `029-create-mark-sheets` | mark_sheets | `029-create-mark-sheets` |
| `030-create-mark-sheet-rows` | mark_sheet_rows | `030-create-mark-sheet-rows` |
| `031-create-result-visibility-overrides` | result_visibility_overrides | `031-create-result-visibility-overrides` |
| `032-create-student-fee-months` | student_fee_months | `032-create-student-fee-months` |
| `033-create-fee-payments` | fee_payments | `033-create-fee-payments` |
| `034-create-fee-allocations` | fee_allocations | `034-create-fee-allocations` |
| `035-create-expenses` | expenses | `035-create-expenses` |
| `036-create-audit-logs` | audit_logs | `036-create-audit-logs` |
| `037-create-student-promotions` | student_promotions | `038-create-student-promotions` |
| `038-create-student-status-events` | student_status_events | `038-create-student-status-events` |
| `039-create-block-dates` | block_dates | `043-create-block-dates` |
| `040-create-locations` | locations | `044-create-locations` |
| `041-refresh-tokens` | refresh_tokens | `050-refresh-tokens` |
| `042-create-attendance-changes` | attendance_changes | `056-create-attendance-changes` |
| `043-create-attendance-reminders` | attendance_reminders | `056-create-attendance-reminders` |
| `044-fee-structures` | fee_structures | `059-fee-structures` |
| `045-student-credit-ledger` | student_credit_ledger | `060-student-credit-ledger` |
| `046-fee-import-batches` | fee_import_batches | `061-fee-import-batches` |
| `047-fee-import-rows` | fee_import_rows | `061-fee-import-rows` |
| `048-create-other-incomes` | other_incomes | `062-create-other-incomes` |
| `049-create-fee-type-policies` | fee_type_policies | `066-create-fee-type-policies` |
| `050-create-families` | families | `067-create-families` |
| `051-create-family-members` | family_members | `068-create-family-members` |
| `052-create-school-concession-reasons` | school_concession_reasons | `069-create-school-concession-reasons` |
| `053-create-student-fee-concessions` | student_fee_concessions | `069-create-student-fee-concessions` |
| `054-create-student-fee-concession-fee-types` | student_fee_concession_fee_types | `070-create-student-fee-concession-fee-types` |
| `055-create-student-fee-concession-events` | student_fee_concession_events | `071-create-student-fee-concession-events` |
| `056-create-student-fee-month-adjustments` | student_fee_month_adjustments | `073-create-student-fee-month-adjustments` |
| `057-create-permissions` | permissions | `080-create-permissions` |
| `058-create-roles` | roles | `081-create-roles` |
| `059-create-role-permissions` | role_permissions | `082-create-role-permissions` |
| `060-create-school-permission-versions` | school_permission_versions | `091-create-school-permission-versions` |

Earlier, several migrations per table were merged into these files. The data-only migrations were
dropped: no-ops, backfills that do nothing on an empty database, and the permission-catalog seed
that the app syncs at runtime. The legacy `exam_marks_legacy` / `fee_due_legacy` tables are no
longer created. Two one-off SQL scripts live under `tests/fixtures` for their tests:
`088-dedupe-application-documents.js` and `student-credit-ledger-backfill.js`.

Fresh environments: `npm run db:migrate` (expect 60 "up"). Staging (dev) then gets the dev seed
(see `.model_docs/docs/DEPLOYMENT-STAGE.md`); production is never seeded.

## Schema check (2026-10-31)

A database built from these files matches `creative_leaders_db` column for column (including
order), with the same types, defaults, nullability, enums, foreign keys, indexes and CHECKs. There
are no triggers, functions or views. Remaining differences are only spelling or naming:
- CHECK lists are printed as `(ARRAY[...])::text[]` instead of casting each element.
- Older databases still carry the names `school_settings_pkey1`, `school_settings_id_seq1` and
  `school_settings_fk_school_id_fkey1` from a past table rebuild. A fresh database uses the
  standard names without the `1`.

`creative_leaders_db` has 62 tables: these 60 plus `SequelizeMeta` (Sequelize's migration log) and
`SequelizeMeta_archive` (a record of earlier migration filenames; local databases only).

## History

On 2026-10-31 the local dev and test databases had `SequelizeMeta` re-pointed to these 60
filenames in a single transaction, with no schema or data change. Any other database that ran the
earlier filenames needs the same re-point, or a rebuild.
