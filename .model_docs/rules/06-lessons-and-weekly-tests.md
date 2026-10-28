# Lessons and weekly tests

Sources: SRS §5.4, §5.5, §6.6, §15.6, §15.7, §15.11; UR-04, UR-05, UR-06; BR-05, BR-06, BR-07, BR-08.

## Planned chapters

Operations Manager or Super Admin defines the plan per class and subject: chapter number, title, planned start, planned end.

Chapter status: `Planned`, `InProgress`, `Completed`.

Chapter number is unique inside a class and subject.

A chapter that already has lessons is not deleted.

## Daily lesson

BR-05. Management defines the plan. The teacher who owns that class and subject posts the update.

A lesson stores: school, class, subject, teacher, planned chapter, date, topic, classwork, homework, notes.

Review status:

| Status | Who sets it | Who can see it |
|---|---|---|
| `Submitted` | Teacher, on create | Management and the author |
| `Approved` | Operations Manager or Super Admin | Those, plus the linked parent |
| `Rejected` | Operations Manager or Super Admin, with a note | Management and the author |

Parents only receive `Approved` lessons. Unpublished or rejected text is not in a parent payload.

An approved lesson is locked for the teacher. They do not silently rewrite it.

Class diary notices are a separate object (Homework, Classwork, Notice) with their own status (`Draft`, `Approved`, `Published`, `Rejected`). Parents see notices only when `Published`. Do not treat "send for approval" as the same state as "published".

## Weekly tests

BR-06. One active schedule per class and subject: weekday, period, maximum marks.

The schedule generates the month's tests on that weekday. Each test stores class, subject, teacher, date, week, month, title, maximum marks, and status.

| Status | Meaning |
|---|---|
| `Scheduled` | Created, marks not complete |
| `MarksEntered` | Every required student has a mark or an absent flag |
| `Published` | Parents may see it |

BR-07.

- The assigned teacher, or management, enters marks.
- A mark is from 0 through the test maximum. Absent is allowed and is not a numeric mark.
- Marks cannot be entered for a test date that has not arrived.
- Publish is allowed only from `MarksEntered`, and only by Super Admin or Operations Manager.
- Parents see a test only when `Published`, and only for a linked child.
- Publishing locks further mark edits.

## Monthly outcome

For one student, one subject, one month, after tests are published:

| Outcome | Rule |
|---|---|
| `Failed` | Failed tests in that subject-month are greater than `maxFailsPerMonth` (default 1, so two failures fail the month). BR-08. |
| `LowMarks` | Not failed, LowMarks is enabled, passed tests are at least `lowMarksMinPassed` (default 3), and the average is below `lowMarksBelowPercent` (default 55). |
| `Passed` | Enough published tests, none of the above. |
| `InProgress` | The month's tests are not all published yet. |

A test is failed when obtained marks are below `passPercent` of that test's maximum (default 40). Absent counts as not passed.

Failed takes precedence over LowMarks. A `Failed` outcome is audited and appears on the follow-up list.

These thresholds live in `dailyTestRules` and may be changed by Super Admin or Operations Manager. They are school-wide until the school asks for per-class or per-subject pass marks.

The monthly summary is per student, class, subject, and month. It is not one blob per student for every subject.
