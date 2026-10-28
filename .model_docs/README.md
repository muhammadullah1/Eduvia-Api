# Eduvia model docs

Working contract for Creative Leaders School. These files sit beside `Eduvia-Api` and `Eduvia-Frontend`. They are the rules later model and feature work should follow.

| File | What it is |
|---|---|
| [srs.md](srs.md) | Unified SRS v1.1 rewritten from `Creative_Leaders_School_Unified_SRS_Abler_v1.1.pdf` (baseline 20 Sep 2026 + addendum 28 Sep 2026). |
| [rules/](rules/) | Normative rules. Each rule has an id, a source, and a must-statement. |

## Precedence

1. Addendum v1.1 wins wherever it is more specific than the 20 Sep baseline.
2. The baseline still applies to anything the addendum does not change.
3. [Eduvia-Api/EDUVIA-4-DECISIONS.md](../EDUVIA-4-DECISIONS.md) records working defaults for questions the school has not signed. Those defaults are implementation choices, not signed requirements.
4. When Sequelize models `001`–`036` disagree with services and `constants/`, the services, constants, and these rules are the intended contract. See [rules/10-code-alignment.md](rules/10-code-alignment.md).

## Rule index

| File | Covers |
|---|---|
| [00-precedence.md](rules/00-precedence.md) | How to read conflicts, open questions, and code drift |
| [01-roles-and-access.md](rules/01-roles-and-access.md) | UR-01, BR-14, row scope |
| [02-academic-structure.md](rules/02-academic-structure.md) | Sessions, classes, subjects, teachers, BR-01, BR-02, BR-13 |
| [03-admissions-and-students.md](rules/03-admissions-and-students.md) | Admission chain, lifecycle, profiles |
| [04-attendance.md](rules/04-attendance.md) | Class attendance |
| [05-timetable-and-substitutes.md](rules/05-timetable-and-substitutes.md) | Conflicts, UR-03, BR-03, BR-04 |
| [06-lessons-and-weekly-tests.md](rules/06-lessons-and-weekly-tests.md) | UR-04–UR-06, BR-05–BR-08 |
| [07-examinations-and-results.md](rules/07-examinations-and-results.md) | Marks, ranks, DMC, UR-07, BR-09, BR-10 |
| [08-fees-finance-and-sync.md](rules/08-fees-finance-and-sync.md) | Fees, UR-08, UR-09, BR-11, BR-12, finance, offline sync |
| [09-security-audit-reports.md](rules/09-security-audit-reports.md) | Audit, privacy, reports, dashboards |
| [10-code-alignment.md](rules/10-code-alignment.md) | What the API and frontend actually do today |
