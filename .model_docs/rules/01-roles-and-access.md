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

`super_admin` is still a user of one school. There is no cross-school operator.

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

This is the current server matrix. New routes add a capability here before they ship.

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
