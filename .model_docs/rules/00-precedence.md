# Precedence and how to apply these rules

## Sources

| Order | Source | Date | Role |
|---|---|---|---|
| 1 | SRS addendum v1.1 | 28 Sep 2026 | Wins on conflict. Roles, one-subject teachers, substitutes, planned chapters, weekly tests, fee-gated results, accountant totals, oldest-unpaid-first. |
| 2 | SRS baseline v1.0 | 20 Sep 2026 | Still in force for admissions, exams, fees, finance, attendance, parent portal, reports, audit, and offline sync, except where the addendum is more specific. |
| 3 | `Eduvia-Api/EDUVIA-4-DECISIONS.md` | implementation notes | Working defaults. Not a client sign-off. |
| 4 | API `constants/` + services | current code | Intended runtime contract. |
| 5 | Migrations `001`–`036` and some frontend leftovers | current code | Must be brought into line with 1–4. Do not treat drift as a new requirement. |

## Product shape

One school system, three phases, one data set:

- Phase 1 — internal management: sessions, classes, subjects, teachers, timetable, admissions, students, exams, fees, finance, reports, offline fee sync.
- Phase 2 — teacher portal: own classes only. Attendance, lessons, updates, marks.
- Phase 3 — parent portal: linked children only, read-only.

Information is entered once. Management owns master records. Teachers enrich academic records. Parents see the approved slice.

## Scope that stays out

- Not a payroll or HR system. Staff cost is an expense category only.
- Not transport, library, or inventory.
- Dashboard and report totals are calculated from records. They are never stored as manually edited figures.

## Open questions

Do not invent answers. Until the school confirms them, use the working default and keep the choice configurable.

| Topic | Baseline / addendum leaves open | Working default in code |
|---|---|---|
| Fee condition that gates parent results | Not fixed in the addendum | `all_due_paid`. Alternatives: `exam_month_paid`, `disabled`. Super Admin only may change it. |
| Who may allocate a payment off oldest-first | Addendum allows an authorized explicit allocation | Super Admin only (`fees.payments.allocate_manual`). |
| Advance horizon | Addendum does not cap credit | 12 months, remainder stays `unallocated_amount`. |
| Operations Manager and fee amounts | Addendum bars collection totals from the accountant; ops fee visibility is less specific | Ops may see per-student paid/unpaid status, not school totals. |
| LowMarks | Addendum only requires a failure flag after more than one failed weekly test | LowMarks when at least 3 tests are passed and average is below 55%. Failed wins over LowMarks. |
| Weekly pass mark | "Configurable by management" | One school-wide `passPercent` (40). |
| Arrears before the ledger start | Not specified | Months generate from the later of admission month and current session start. |
| Period clock | Not specified | Period N is the same time school-wide. A teacher free at weekday + period is free in every class. |
| More than one current session | Asked, not confirmed | Exactly one current session. |
| Same subject, many teachers | Asked, not confirmed | Yes, across classes. One teacher still has one active subject. |
| Class sections | Asked, not confirmed | Code uses grade + section. Baseline text did not require sections. |
| Mandatory admission fields and documents | Asked, not confirmed | Wizard requires name, DOB, class, guardian, phone, and a decision. Default docs: birth certificate, SLC, CNIC, photo. |
| Interview mandatory / pass mark | Asked, not confirmed | Interview step exists. No minimum score. |
| Multiple guardians | Asked, not confirmed | A student may have more than one parent link. One may be primary. |
| Bulk promotion | Not requested | Not implemented. Do not add it as if it were required. |
| Timetable conflict: block or warn | Asked | Block. Substitutes are a separate workflow, not a warning bypass. |
| Tied ranks | Asked | Not implemented. Do not pick a tie policy silently. |
| Attendance edit window | "Same day or same week, as configured" | No lock in the live store. Do not pretend a window exists until one is configured. |
| Late / excused attendance | Baseline allows school-configured statuses | Live contract is `Present`, `Absent`, `Leave`. |
| Payment method on income and expenses | Asked | Payments record method. Expenses record category, amount, date, notes. |

## Writing new models

- School-scope every tenant row with the school on the authenticated user.
- Store history on the record that happened (lesson, test, mark, attendance, substitution), not by rewriting the teacher's current subject.
- Prefer status enums in these rule files and in `constants/`. If a migration enum differs, change the migration to match the rule.
