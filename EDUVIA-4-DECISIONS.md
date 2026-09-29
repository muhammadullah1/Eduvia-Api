# EDUVIA-4 decisions (uncommitted)

## Teacher ↔ subject
- Prefer 1:1 via `teachers.fk_primary_subject_id` + API `POST /teachers/:id/primary-subject`.
- Keep `teacher_subjects` join for flexibility/history; assignSubjects defaults to a single primary when only primarySubjectId is sent.
- UI shows one editable primary subject.

## Roles
- Added `accountant` (fee desk) and `controller` (oversight ≈ management control).
- Kept `management`, `teacher`, `parent`.
- `MGMT_ROLES` = management + controller; `FEE_ROLES` = management + accountant + controller.

## Fee gate on results
- `mark_sheets.fee_period` links to fee ledger period labels parents see.
- On publish: unpaid students get `blocked_by_fee=true`, `visible_to_parent=false` unless `manual_override`.
- Override: `POST /exams/:id/override-fee` with reason (management/controller).

## Variable periods
- `classes.period_count` (default 8); timetable `period_index` 1..N.

## Monthly tests
- Pass mark default 40%.
- failed_count ≥ 2 ⇒ Failed.
- passed_count ≥ 3 AND average_percent < 55 ⇒ LowMarks.
- Else if no fails ⇒ Passed; else InProgress.

## Fee add UX
- Same fields as parent portal: student, period, type, amount, method, status, paidOn/date, ref, dueDate, notes.
