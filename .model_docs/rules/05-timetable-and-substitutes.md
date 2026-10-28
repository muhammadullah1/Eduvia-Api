# Timetable and substitutes

Sources: SRS §4.2.5, §15.5; UR-03; BR-03; BR-04.

## Timetable slot

A slot is one period: school, class, teacher, subject, weekday, period index, start time, end time, room.

Weekdays are Sunday through Saturday by name.

## Conflicts — block, do not warn

Two partial unique constraints:

- one class, one weekday, one period index;
- one teacher, one weekday, one period index, inside the school.

A class cannot have two subjects in the same period. A teacher cannot be in two classes in the same period.

Period index is from 1 through the class period count. Shrinking `periodCount` is refused when a slot already uses a higher index. Period count stays between 1 and 16.

Working assumption, still unconfirmed by the school: period N is the same clock time across the school. A teacher free at weekday + period is free for every class.

The subject on a new slot defaults to the teacher's active subject (BR-02). The user may only depart from that when the slot is an explicit cover, which is a substitute row, not a second permanent slot.

## Teacher absence

One absence is one teacher, one date, one period. It is not a whole-day row.

| Status | Meaning |
|---|---|
| `Pending` | Absent for that period, and the period has a class that still needs a cover |
| `Covered` | A substitute is assigned |
| `Cancelled` | The absence was withdrawn |
| `NoClass` | The timetable has no slot for that teacher in that period, so there is nothing to cover |

Marking absent looks up the timetable. No slot → `NoClass`. A slot → `Pending`, and the absence remembers class, subject, and slot.

## Substitute

| Rule | Statement |
|---|---|
| BR-04 | The system lists people who are free. A manager chooses. The system does not pick for them. |
| BR-03 | The chosen teacher must be free for that date and period. |
| Record | Date, period, original teacher, substitute, class, subject, who authorized it. |
| Portal | The substitute sees that period on their teacher Today view. |
| Uniqueness | One substitute cannot hold two covers for the same date and period. |

Free means all of the following:

- no timetable slot of their own in that weekday and period;
- not already substituting that date and period;
- not themselves absent that date and period.

Same-subject candidates are listed first. That is a sort, not a filter. A different subject may still be chosen.

Assignment runs inside a transaction with a lock. If the substitute became busy after the list was loaded, the assign call returns a conflict and does not write the row.

Removing the substitute returns the absence to `Pending`. Cancelling the absence sets `Cancelled` and removes the cover.

Do not implement substitutes by inserting a second timetable slot on top of the original teacher. The original slot stays. The cover is a separate row.
