# Roles and access

Sources: SRS §3, addendum §15.2, UR-01, BR-14. Server matrix: `Eduvia-Api/constants/permissions.js`.

## Roles

| Enum | Who | Portal |
|---|---|---|
| `super_admin` | Super Admin. Full control, including fee totals, manual allocation, fee and result-visibility settings, audit. | `/admin` |
| `operations_manager` | Academic / Operations Manager. Non-accounting operations. | `/operations` |
| `accountant` | Accountant. Record payments and own daily records. No calculated totals. | `/accountant` |
| `teacher` | Teacher. Own subject, own classes, and substitute periods. | `/teacher` |
| `parent` | Parent. Linked children, read-only. | `/parent` |

Legacy names `management` and `controller` map to `super_admin` and `operations_manager`. Do not introduce new role strings.

There is one role per user. A person is not both teacher and accountant.

`super_admin` is still a user of one school. There is no cross-school operator. Each campus is a separate tenant.

The fixed matrix below is today's contract. The target dynamic, per-school design is in [11-dynamic-roles-and-permissions.md](11-dynamic-roles-and-permissions.md).

## Enforcement

- BR-14: every protected API route checks a capability on the server. The menu is not the control.
- The school id comes from the authenticated user. Do not trust a school id in the body.
- Row scope is separate from the capability:
  - parent → linked children only;
  - teacher → own classes and active subject, plus periods they are substituting;
  - accountant → payments they recorded, when the screen is "my collections".
- A parent response must not include another student's rows, even if the id is guessed.
- An accountant response for collections must not include a grand total, a sum, or any aggregate of amounts. Super Admin is the only role with `fees.totals`.

## Capability map

`Eduvia-Api/constants/permissions.js` is the source of truth; this table is a summary and may lag. Changes since it was written (29 Oct 2026 check): Ops lost `fees.months.read`; Ops gained read-only `audit.read` (fee entries filtered); `exams.read` includes parent; new capabilities `leave.*`, `reports.dashboard`, `documents.read`, `attendance.review/edit`, `fees.amounts.read` (SA, ACC, PAR — drives `redact_fee_fields`), `fees.reports`, `fees.structure.*`, `fees.credit.read`, `fees.import`, `fees.concessions.*`, `fees.months.adjust`, `families.*`, `income.*`, `finance.reports`; `expenses.read` no longer includes Ops. `/admin/messages` was removed.

New routes add a capability here before they ship.

| Capability | Roles |
|---|---|
| `account.self` | all five |
| `school.read` | all five |
| `school.update` | super_admin |
| `settings.read` | super_admin, operations_manager |
| `settings.academic.update` | super_admin, operations_manager |
| `settings.fees.update` | super_admin |
| `audit.read` | super_admin |
| `users.read`, `users.create` | super_admin, operations_manager |
| `academic.read` | all five |
| `academic.manage` | super_admin, operations_manager |
| `teachers.read` | super_admin, operations_manager, teacher |
| `teachers.manage` | super_admin, operations_manager |
| `teachers.self` | teacher |
| `students.read` | all five |
| `students.manage`, `parents.manage`, `admissions.manage` | super_admin, operations_manager |
| `attendance.read` | super_admin, operations_manager, teacher, parent |
| `attendance.mark` | super_admin, operations_manager, teacher |
| `timetable.read` | all five |
| `timetable.manage` | super_admin, operations_manager |
| `absences.read`, `absences.manage` | super_admin, operations_manager |
| `chapters.read` | super_admin, operations_manager, teacher |
| `chapters.manage` | super_admin, operations_manager |
| `lessons.read` | super_admin, operations_manager, teacher, parent |
| `lessons.write` | teacher |
| `lessons.review` | super_admin, operations_manager |
| `tests.read` | super_admin, operations_manager, teacher, parent |
| `tests.schedule`, `tests.publish` | super_admin, operations_manager |
| `tests.marks` | super_admin, operations_manager, teacher |
| `exams.read` | super_admin, operations_manager, teacher |
| `exams.create`, `exams.verify`, `exams.publish` | super_admin, operations_manager |
| `exams.marks` | super_admin, operations_manager, teacher |
| `results.override` | super_admin, operations_manager |
| `results.parent` | parent |
| `fees.months.read` | super_admin, operations_manager, accountant, parent |
| `fees.months.generate` | super_admin, accountant |
| `fees.payments.read` | super_admin, accountant, parent |
| `fees.payments.record` | super_admin, accountant |
| `fees.payments.allocate_manual` | super_admin |
| `fees.payments.confirm` | super_admin |
| `fees.collections.mine` | accountant |
| `fees.totals` | super_admin |
| `expenses.read` | super_admin, operations_manager, accountant |
| `expenses.create` | super_admin, accountant |
| `expenses.manage` | super_admin |
| `updates.read` | all five |
| `updates.write` | super_admin, operations_manager, teacher |
| `updates.review` | super_admin, operations_manager |

## Staff creation

- Super Admin may create any staff role.
- Operations Manager may create teachers, not Super Admins, accountants, or other operations managers.
- A teacher cannot be created without a subject.
- Parents are created and linked through the parent relationship, not by giving them a staff role.

## What each portal may show

**Super Admin.** Academic setup, people, admissions, timetable, absences, chapters, lesson review, weekly tests, exams, result visibility, communication, fees including totals, finance, settings, audit.

**Operations Manager.** The same operational modules. No fee totals, no finance aggregates, no fee-rule or result-visibility settings. Per-student fee status is allowed. Amounts collected across the school are not.

**Accountant.** Record a payment, generate fee months, print own daily rows and receipts. No running total.

**Teacher.** Today, own classes, attendance, daily update, weekly-test marks, class notices, exam marks through submit. No fees. No other teachers' classes. No publish of weekly tests and no verify or publish of exam sheets.

**Parent.** Own children: attendance, published weekly tests, fee months and receipts, timetable, approved lessons and published notices, examination results only when the fee gate or an override allows them.

## Implemented state (EDUVIA-16 Phase 1, 30 Oct 2026)

- **Catalog:** `permissions` table (migration 080) seeded from `Eduvia-Api/constants/permissions.js` (key, module, label, description, risk, assignable roles). `authorize()` with an unknown key throws at startup.
- **Per-school roles:** `roles` (081) and `role_permissions` (082), school-scoped; 083 seeds the 5 system roles for every school with exactly the previous static map (snapshot test proves day-one equality). No custom roles or per-user grants yet; schema allows them later. `users.role` stays an enum.
- **Locked invariants (code, not data):** Super Admin always holds every permission and each school keeps ≥1 active Super Admin; SA-only keys (fee totals, finance reports, income, roles.manage, fee settings, manual allocation, payment confirm, bill adjustments, concession approval, fee structure update, expense edit) cannot be granted; sign-in keys (`account.self`, `school.read`) cannot be revoked; Teacher/Parent are revoke-only. Locks are returned per key with a reason (`lockReason`) and enforced by the API (400 on a locked grant). Service-level redaction (accountant no totals, Ops/Teacher fee amounts redacted, parent own-child + publish/fee gates) is independent of grants.
- **Enforcement:** `authorize(...keys)` reads effective permissions from a per-process cache keyed by school+role, invalidated on save/reset. Multi-instance deployments need a shared cache or short TTL (open decision).
- **Session:** login and `GET /auth/me` return `permissions`. The FE stores them (zustand), refreshes `/auth/me` on focus and every 60 s, and drives sidebar, routes, buttons and data-slice loading from them (`useCan`, `canNow`, `SLICE_READ_PERMISSIONS`). `src/lib/permissions.ts` is deleted; `PermissionKey` is generated from the API catalog (`scripts/generate-permission-keys.mjs`).
- **Single staff portal:** Super Admin, Operations Manager and Accountant use `/admin`; sections are filtered by `requires`/`hiddenWith`. Old `/operations/*`, `/accountant/*` and legacy sections (`overview`, `collect`, `settings-roles`, `?panel=roles`) redirect. A non-permitted section renders an in-app 403 with "Go to my home page".
- **Roles & Permissions page** (`/admin/roles`, `roles.manage`): role cards (users, permission counts), users sheet with change-role dialog, per-role editor with module cards (switch, Sensitive badge, action chips, lock + tooltip reason), sticky Discard/Update bar, diff preview with required reason (5–500 chars), Reset to default, optimistic-concurrency `version` (409 on conflict), Activity tab.
- **Audit:** every save, reset and user role change writes an audit entry (actor, school, role, added, removed, reason; from → to for users), visible in the Activity tab and Audit Trail.
