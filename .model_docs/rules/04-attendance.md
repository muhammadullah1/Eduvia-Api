# Attendance

Sources: SRS §5.3, §6.3, §10; P2-02, P3-02.

## Who marks

A teacher marks attendance for a class they teach, or for a period they are covering as substitute. Super Admin and Operations Manager may also mark. Parents never mark. Accountants do not mark.

## What is stored

One row per student per date: school, class, student, date, status, optional remarks, who marked it.

Live statuses:

| Status | Meaning |
|---|---|
| `Present` | In class |
| `Absent` | Not in class |
| `Leave` | Away with leave |

The baseline also allows Late, Excused, and other school-configured statuses. Add those only when the school turns them on. Do not accept `Leave` in one layer and `Excused` in another for the same meaning.

## Rules

- The roster is the active students of that class. Withdrawn students are not in the marking list.
- Saving a class-day replaces that day's marks for that class. It does not create a second row for the same student and date.
- Marks are visible to management as soon as they are saved, and to the linked parent.
- A parent sees only their child's rows.
- A teacher sees attendance for their classes, not the whole school.
- Summaries (daily counts, weekly, monthly, student percentage, class percentage) are calculated from these rows.
- Edits inside a configured window must keep a change history: who, previous status, new status, when. The window length is a school setting. Until the school sets one, do not invent a silent lock, and do not drop the history requirement when a window is added.
- The dashboard must not keep a separate attendance total.

## Not the same as teacher absence

Student attendance is this file. A teacher being away for a period is the substitute workflow.
