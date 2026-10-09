# EDUVIA-4 decisions — SRS Addendum v1.1 (28 Sep 2026)

The addendum is layered on SRS v1.0; where it is more specific it wins. The earlier EDUVIA-4 work
is committed (API `acd25ee`, FE `1d3d570`). The addendum work is additive and uncommitted:
migration `20260929180001-eduvia4-addendum-v1-1.js` plus the reworked demo seeder.

FE paths are relative to `Eduvia/src`. API paths are relative to this repo.

## Roles (UR-01)

| Enum value           | Label                          | FE portal                | Scope |
|----------------------|--------------------------------|--------------------------|-------|
| `super_admin`        | Super Admin                    | `/admin/dashboard`       | Everything, including fee totals, manual allocation, payment confirmation, fee/result-visibility settings, audit log |
| `operations_manager` | Academic / Operations Manager  | `/operations/overview`   | All non-accounting operations: classes, subjects, teachers, timetable, admissions, students, attendance, absences/substitutes, chapters, lesson review, weekly tests, exams, results, overrides, academic rules. Can see per-student fee status, never totals or amounts collected |
| `accountant`         | Accountant                     | `/accountant/collect`    | Record payments, generate fee months, own daily collection records, receipts. No totals |
| `teacher`            | Teacher                        | `/teacher/today`         | Own classes and subject, substitute periods, attendance, daily updates, weekly-test marks, exam marks |
| `parent`             | Parent                         | `/parent/home`           | Linked children only |

- Migration mapping: `management → super_admin`, `controller → operations_manager`.
- Legacy FE URLs `/management/*` and `/controller/*` redirect to the new slugs.

## Permission matrix (BR-14)

- `constants/permissions.js` is the single source of truth. Every route declares `authorize("<capability>")`
  (`middlewares/authorize.js`).
- Row-level scoping lives in `services/access.service.js`:
  - parent → linked children only;
  - teacher → own classes/subject plus substitute periods;
  - accountant → own receipts only.
- Setting keys have per-key write permissions (`services/settings.service.js`):
  - academic rules: super_admin and operations_manager;
  - fee and result-visibility rules: super_admin only.
- The FE mirror (`lib/permissions.ts`) only shapes menus. The demo store (`data/store.tsx`, `denied()`) also refuses
  forbidden actions, but the API is the real enforcement point.

## Requirement mapping

| Req | Rule | API | FE |
|-----|------|-----|----|
| UR-01 / BR-14 | Three operational roles; permissions enforced server-side | `constants/index.js` USER_ROLES, `constants/permissions.js`, `middlewares/authorize.js`, all `routes/*` | `lib/auth.ts`, `lib/permissions.ts`, `features/shell/portal.tsx` |
| UR-02 / BR-01 | Teacher needs exactly one active subject; management can change it | `validations/user.js` (subjectId required for teachers), `teachers.fk_subject_id NOT NULL`, `PUT /teachers/:id/subject` (reason, audited) | People dialog (subject required), `TeacherSubjectDialog` in `features/management/screens.tsx` |
| BR-02 | Active subject is the default for teaching access and new assignments | `teacher.service.js` / `access.service.js` (teacher write access = own subject/classes); timetable defaults to the teacher's subject | Slot form preselects the teacher's subject |
| BR-13 | History is not rewritten | `teacher_subject_assignments` (from/to, reason, changed_by); lessons, tests, marks, attendance and substitutions keep their own subject_id/class_id | `Staff.subjectHistory`; records store their own subject |
| UR-03 / BR-03 / BR-04 | Engine finds free teachers; manager picks; busy teacher rejected | `utils/substitutes.js`, `services/teacher_absence.service.js`: `GET /teacher-absences/:id/available-substitutes`, `PUT /teacher-absences/:id/substitute` (409 if busy, re-checked inside a transaction); partial unique timetable indexes | `lib/academics.ts` (`availableSubstitutes`, `busyReason`), `AbsencesPanel` (`features/ops/screens.tsx`), teacher Today shows substitute periods |
| UR-04 / BR-05 | Planned chapters per class+subject; teacher posts daily update; management approves; parents see approved | `/planned-chapters`, `/daily-lessons` (+ `POST /:id/review`); parent reads Approved only | `CurriculumPanel`, `LessonReviewPanel`, `TeacherDailyUpdate`, `ParentUpdates` |
| UR-05 / BR-06 / BR-07 | One scheduled test day per subject each week; teacher enters marks; parent sees after publish | `daily_test_schedules`, `/daily-tests/schedules`, `/generate`, `/:id/marks`, `/:id/publish`, `/monthly-summary` | `WeeklyTestsPanel`, `TeacherWeeklyTests`, `ParentTests` (published only) |
| UR-06 / BR-08 | More than one failed test in a subject in a month ⇒ Failed + flagged | `utils/monthly_status.js` `summarizeMonth(rules)`; rules in `school_settings.daily_test_rules`; `GET /daily-tests/flagged`; Failed outcomes audited on publish | `lib/academics.ts` `summarizeMonth`, Settings → academic rules |
| UR-07 / BR-09 / BR-10 | Publication and parent visibility are separate; fee rule checked at view time; audited override | `exam.service.js` (`parentResults`, `gateStatus`), `school_settings.result_visibility.fee_rule`, `result_visibility_overrides` (+ audit) | `lib/academics.ts` `resultVisibility`, `ResultsGatePanel`, `ParentResults` withheld notice |
| UR-08 / BR-11 | Accountant records payments and prints own daily records; no totals | `GET /fees/collections/mine` (rows only, no aggregates), `GET /fees/payments/:id/receipt`; `fee_payments.fk_recorded_by_user_id`; totals only via `fees.totals` (super_admin) | `AccountantPortal` (`CollectDesk`, `MyCollections` with Print day), `features/fees/receipts.ts` |
| UR-09 / BR-12 | Oldest unpaid month paid first | `utils/fee_allocation.js` plus `fee.service.js` `recordPayment`: one transaction, advisory lock per student, `SELECT … FOR UPDATE` on open months, `fee_allocations` rows; an explicit manual allocation is allowed only with `fees.payments.allocate_manual` (super_admin), is validated against open balances and is audited as `manual`; `idempotency_key` is unique | `lib/fees.ts` (`planOldestFirst`, `allocateOldestFirst`), `RecordPaymentForm`, `FeeMonthTable`, `ParentFees` (every unpaid month listed) |
| §15 | Audit trail | `audit_logs` + entity_type/entity_id/metadata for subject changes, substitute assign/remove, overrides grant/revoke, fee allocations, daily-test outcomes; `GET /audit-logs` (super_admin) | Reports → audit (entity shown) |
| §15 | Offline sync and duplicate protection | Unique `ref` + unique `idempotency_key`; a repeated key returns the original payment | Workbook import uses idempotent keys |

## Schema changes (migration `20260929180001`)

Additive, runs in a single transaction, and has a full `down`. It was tested from scratch (up/down/up) and on the
existing DB.

- `users.role`: new enum values. Rows remapped as listed under Roles.
- `audit_logs`: added `entity_type`, `entity_id`, `metadata`.
- `school_settings` (new): per-school key → JSON. Keys `daily_test_rules`, `result_visibility`, `fees`.
- `classes.monthly_fee`: added.
- Teachers:
  - `teachers.fk_subject_id` is now NOT NULL;
  - `teacher_subject_assignments` (new, history);
  - legacy `teacher_subjects` dropped.
- `timetable_slots`: partial unique indexes on (class, day, period) and (teacher, day, period).
- Absences and substitutes:
  - `teacher_absences` reshaped to one row per date + period; statuses Pending / Covered / Cancelled / NoClass;
  - `substitute_assignments` (new): date, period, original teacher, substitute, class, subject, authorized_by;
    unique per substitute + date + period.
- Lessons:
  - `planned_chapters` (new);
  - `daily_lessons` gained fk_planned_chapter_id, classwork, homework, review_status, submitted_by, reviewed_by, reviewed_at, review_note.
- Weekly tests:
  - `daily_test_schedules` (new);
  - `daily_tests` gained month, week, status, published_by/at;
  - `monthly_student_summaries` gained tests_scheduled and flagged_for_follow_up;
  - `monthly_tests` and `monthly_test_results` dropped (superseded by weekly tests plus the monthly summary).
- Exams and results:
  - `exams` (new);
  - `mark_sheets` gained fk_exam_id and published_by;
  - gate columns dropped from `mark_sheet_rows` (visibility is computed, never stored on the result);
  - `result_visibility_overrides` (new): user, student, exam, reason, granted_at, revoked_by/at.
- Fees:
  - `student_fee_months` (new): Paid / Partially Paid / Unpaid / Advance;
  - `fee_payments` gained fk_recorded_by_user_id, idempotency_key (unique), unallocated_amount, allocation_mode;
  - `fee_allocations` (new): payment ↔ fee month.

## Configurable rules (defaults)

- `daily_test_rules`:
  - `passPercent: 40`, `maxFailsPerMonth: 1` (so 2 or more fails ⇒ Failed + flagged);
  - `lowMarksEnabled: true`, `lowMarksMinPassed: 3`, `lowMarksBelowPercent: 55` (the earlier client rule, kept);
  - Failed takes precedence over LowMarks.
- `result_visibility.fee_rule`:
  - `all_due_paid` (default): every month up to the exam's fee month is paid;
  - `exam_month_paid`;
  - `disabled`.
- `fees.maxAdvanceMonths: 12`. Any remainder stays `unallocated_amount`.

## Demo data

Password `password` everywhere. The FE demo and the API seed are separate data sets.

- **API** (demo day Tue 29 Sep 2026), `database/seeders/20260928191001-eduvia4-creative-leaders-demo.js`
  - Logins:
    - admin@cls.edu.pk: super_admin
    - operations@cls.edu.pk: operations_manager
    - accountant@cls.edu.pk: accountant
    - hassan@, fatima@, bilal@, zainab@, omar@cls.edu.pk: teachers
    - parent@cls.edu.pk: Rayan and Zara
    - kamran@cls.edu.pk: Ayaan
  - Fees:
    - Ayaan: Jul, Aug and Sep unpaid, and the next payment clears July.
    - Daniyal: Aug partially paid.
    - Rayan: Oct Advance.
    - Zara: Sep unpaid.
    - Accountant has 4 receipts today, admin has 1.
  - Absences: Hassan absent P3/4/5/9 today. P4 is covered; the other periods have free candidates.
  - Weekly tests: Ayaan fails 2 Maths tests (Failed + flagged). Hira gets LowMarks.
  - Exam "September Monthly Assessment": Ayaan and Zara withheld; Daniyal released by an audited override.
  - Reset: `npx sequelize db:seed:undo:all && npx sequelize db:seed:all`.
- **FE demo** (localStorage `eduvia-demo-v5`, demo day 23 Sep 2026)
  - Fees:
    - Maya: Jul/Aug/Sep unpaid, all shown to the parent.
    - Ayaan and Ibrahim: Aug and Sep unpaid.
    - Rayan: Sep plus an Oct advance.
    - Hania: Sep partially paid.
  - Absences: Sana absent. P2 covered by Hassan; P3 and P4 pending with free candidates.
  - Weekly tests: Ayaan fails 2 Maths tests (Failed + flagged). Hania becomes LowMarks once week 3 is published.
  - August exam: Maya and Ayaan withheld; Ibrahim released by override.

## Open questions for the client

1. **Which fee condition gates results?** We default to "all dues up to the exam's fee month paid". The other
   options are "exam month only" or "disabled". Who may change it? We assumed Super Admin only.
2. **Period grid:** we assume period N is at the same time across the school, so a teacher free at weekday + period
   is free everywhere. Confirm, or share per-class bell schedules.
3. **Advance payments:** is 12 months the right cap, and should any remainder become credit or be refunded?
4. **Manual (non-oldest-first) allocation:** is Super Admin only correct, or should the Accountant also be allowed
   with a reason?
5. **Operations Manager and fees:** may they see per-student paid/unpaid status (currently yes, with no amounts or
   totals)?
6. **LowMarks:** is it only evaluated once at least 3 tests have been taken? Does Failed always take precedence?
7. **Arrears start:** fee months are generated from admission or the session start. Do earlier arrears need
   importing?
8. **Weekly-test pass mark:** is it one school-wide value, or does it vary by class/subject? It is currently
   school-wide.

## Known limitations

- The FE is still a localStorage demo and is not wired to the API. Its rules mirror the API's so the flows can be
  demoed.
