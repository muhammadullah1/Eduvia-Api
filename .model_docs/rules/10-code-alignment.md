# Code alignment

Reviewed 8 Oct 2026 against:

- `Eduvia-Api` on `EDUVIA-4`
- `Eduvia-Frontend` on `EDUVIA-5`
- Unified SRS v1.1 and `Eduvia-Api/EDUVIA-4-DECISIONS.md`

The rules in this folder are the contract. This file says where the code matches them and where it does not. When a model enum disagrees with a rule, change the model. Do not change the rule to match the drift.

## What already matches

The addendum is implemented as behaviour in API services, `constants/`, and the live frontend store.

| Rule | Where it lives |
|---|---|
| UR-01, BR-14 | `constants/permissions.js`, `middlewares/authorize.js`, `Eduvia-Frontend/src/lib/permissions.ts` |
| BR-01, BR-02, BR-13 | Teacher create requires a subject. Subject change closes history. Records keep their own subject id. |
| UR-03, BR-03, BR-04 | `services/teacher_absence.service.js`, `utils/substitutes.js`, `src/lib/academics.ts` |
| UR-04, BR-05 | Planned chapters, daily lessons, parent reads `Approved` only |
| UR-05–UR-06, BR-06–BR-08 | Weekly schedules, publish gate, `summarizeMonth` |
| UR-07, BR-09, BR-10 | Visibility computed at read time. Overrides audited. Scores unchanged. |
| UR-08, BR-11 | `GET /fees/collections/mine` returns rows and no aggregates. `fees.totals` is Super Admin. |
| UR-09, BR-12 | Oldest-unpaid-first, per-student lock, manual allocation Super Admin only, idempotency key |
| One current session | Activate clears the other `isCurrent` flags |

The mounted frontend is `src/App.tsx` → `src/data/store.tsx` → `src/features/shell/portal.tsx`. `src/portal/*`, `src/types.ts`, and `src/lib/school.ts` are an older demo and are not the live app.

## Schema drift — fix the models

Migrations `001`–`036` and several Sequelize models do not match the services. Services are written for the addendum. These are the clashes that will throw or silently store the wrong meaning.

| Area | Models `001`–`036` | Contract in services and these rules |
|---|---|---|
| School settings | One row of columns per school | Key → JSON: `dailyTestRules`, `resultVisibility`, `fees`. Notices live under `school_updates`. |
| User status | `blocked` | Services check `block` |
| Teacher absence | One row per teacher per date. Status `Pending` / `Approved` / `Rejected` | One row per teacher, date, and period. Status `Pending` / `Covered` / `Cancelled` / `NoClass` |
| Substitute | Missing class, subject, original teacher, authorized-by | Those fields are required |
| Daily lesson | Topic and notes only | Chapter link, classwork, homework, review status, reviewer, review note |
| Daily test | No month, week, or status | `Scheduled` / `MarksEntered` / `Published` |
| Monthly summary | One row per student per month | One row per student, class, subject, and month, with a follow-up flag |
| Exam | Many classes through `exam_classes` | One class on the exam |
| Mark sheet status | `Approved` | `Verified` |
| Fee month status | `Partial` | `Partially Paid`, plus `Advance` |
| Fee payment | No status, allocation mode, or idempotency | `Paid` / `Pending`, `auto` / `manual`, unique idempotency key |
| Application | `Inquiry` through `Approved` | `New` / `Review` / `Waitlist` / `Enrolled` / `Rejected`, plus decision `Admit` / `Reject` / `Waitlist` |
| Attendance | `Late` / `Excused` / `HalfDay` | `Present` / `Absent` / `Leave` |
| Audit log | `oldValues` / `newValues` | Actor, entity type, entity id, metadata |
| Payment method string | `BankTransfer` | Validation has also used `"Bank transfer"`. One spelling: `BankTransfer` |

`student_leave_requests` has a table and no routes. Leave as an attendance status does not create a leave request.

## API behaviour still short of the SRS

- Enroll does not link a parent, does not set `enrolledStudentId`, and does not open the first fee month.
- Class capacity is not checked on enroll.
- No session lock. Past sessions stay editable. The SRS never required a hard lock; it did require permanent promotion and status history.
- Inactive, Graduated, and Struck off are baseline lifecycle states (P1-03). The live student enum is only `Active` / `Pending` / `Withdrawn`.
- Ranks, tie policy, and PDF DMC / result documents are specified and not produced. The parent DMC action is a toast.
- Offline Excel sync is specified (P1-08). The API has no import. The frontend fakes one from the filename.
- Notices are a JSON blob on settings, not rows with a class foreign key.
- Attendance save does not always set school id and the user who marked it.
- `PUT /settings/:key` is authorized as `settings.read`. The real write check is inside the service. The route should declare the write capability.
- Platform middleware reads a `version` header it never loads.
- Login finds a user by email globally. The database unique key is school + email.
- Fee, subject-change, substitute, override, lesson-review, test-publish, and settings changes are audited. Attendance edits, student status changes, and marks finalization are not, and the SRS asks for those.
- Dashboard graphs in SRS §4.1 are not a server-calculated report set.
- There is no school-creation API. Only the current school can be read and updated.

## Frontend behaviour still short of the rules

The live portal hydrates from the API when a token exists, and otherwise keeps the demo seed in `localStorage` (`eduvia-demo-v5`). Writes are optimistic. A failed request often only logs.

- Parent children are `PARENT_CHILDREN`, or every student when the school has 10 or fewer. The server must scope by the parent link.
- Teacher screens use a fixed `TEACHER_ID` (`st-hassan`), not the logged-in teacher.
- The actor name comes from the URL role, not the JWT user.
- `admissions.manage`, `exams.manage`, `academic.manage`, `audit.view`, and `settings.fees` are declared and do not guard the screens that perform those actions.
- Demo password `password` is still sent when staff are created from the UI.
- Two clocks exist: frontend `TODAY` is 23 Sep 2026, the API demo day is 29 Sep 2026. Date rules such as "cannot mark a future test" follow whichever clock that layer uses.
- Legacy types in `src/types.ts` still say `management`, `Inactive`, `Graduated`, `Struck off`, and fee status `Overdue`. New work uses `src/data/types.ts`.

## Do not "fix" by copying the wrong layer

| If you are about to… | Do this instead |
|---|---|
| Add `Approved` as a mark-sheet status because the migration has it | Store `Verified` |
| Model teacher absence as one row per day | One row per date and period |
| Let the client send fee-month status | Derive `Unpaid` / `Partially Paid` / `Paid` / `Advance` |
| Hide accountant totals only in React | Omit aggregates in the API payload |
| Filter parent results only in the screen | Apply the fee gate in `parentResults` |
| Treat `src/portal/*` as the product | Follow `src/features/*` and `src/data/types.ts` |
