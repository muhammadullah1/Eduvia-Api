# Academic structure

Sources: SRS §4.2, §10; addendum §15.3–15.4; BR-01, BR-02, BR-13; P1-01.

## School

A school is the tenant. Users, sessions, classes, subjects, students, teachers, parents, fees, and exams belong to one school. Codes and emails used as school identifiers are unique.

## Academic session

- Fields: name, start date, end date, whether it is current.
- Names are unique inside a school.
- End date is on or after start date.
- At most one session is current. Activating one clears the flag on the others in the same transaction.
- New admissions, new fee generation, and new exams attach to the current session.
- Past sessions stay readable. The baseline allows editing a session's name and dates while it is in use. It does not define a hard lock on historical sessions.

## Subjects

- Fields: name, optional code, active flag.
- The same subject name is not created twice for the school. The baseline also says "same name, same session"; the live model uniques name per school. Keep one subject row and reuse it across sessions and classes.
- A subject may be taught in many classes, by different teachers.
- Deactivate instead of delete when exams, marks, or lessons still point at it. History stays visible.

## Classes

- A class belongs to one session.
- Identity is grade + section inside that school and session (for example Class 5, section A). The baseline left sections unconfirmed; the code already has them. Do not collapse section away.
- A class has a period count, a room, a capacity, a status (`Active` or `Archived`), and a monthly tuition amount.
- Subjects are linked on the class. A link may say how many periods per week and whether the subject is elective.
- Students enroll into a class that exists on the selected session.

## Teachers

- A teacher is a user plus a staff record: employee code, qualification, joining date, status.
- Status values: `Active`, `OnLeave`, `Resigned`, `Terminated`.
- Employee code is unique per school. One user has at most one teacher row.
- **BR-01.** Exactly one active subject. Create fails without it.
- **BR-02.** New timetable slots and new class assignments default to that subject.
- **BR-13.** Changing the subject closes the open history row (effective end, reason, who changed it) and opens a new row. Closed rows are not edited. Lessons, tests, marks, attendance, and substitutions keep the subject id they were saved with.
- Teaching assignment to a class is still required. Roles on a class: `ClassTeacher` or `SubjectTeacher`.
- This is not payroll. `monthlySalary` may exist as a number. It does not calculate pay.

## Settings that are school-wide

Stored per school, not hardcoded in screens.

| Key | Who may write | Working default |
|---|---|---|
| `dailyTestRules` | super_admin, operations_manager | pass 40%, max fails per month 1, LowMarks on, at least 3 passes, below 55% |
| `resultVisibility` | super_admin | fee rule `all_due_paid`, override reason required |
| `fees` | super_admin | default monthly fee, due day 10, max advance months 12 |

Academic rules and fee rules are different permissions. Operations Manager does not change fee or result-visibility settings.
