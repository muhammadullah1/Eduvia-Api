# Examinations and result visibility

Sources: SRS §4.4, §6.4, §15.8; P1-04, P2-04, P3-02; UR-07; BR-09, BR-10.

## Exam

An exam belongs to one school, one session, and one class. It has a name, a start, an end, and a fee month that the visibility rule reads.

Creating an exam creates one mark sheet per subject taught in that class, and one empty row per active student.

Exam names are unique inside a school and session.

## Mark sheet

One sheet is one exam, one class, one subject. It has total marks (default 100) and passing marks (default 40).

| Status | Allowed next | Who |
|---|---|---|
| `Draft` | `Submitted` | Teacher for their subject, or management |
| `Submitted` | `Verified` or back to `Draft` | Operations Manager or Super Admin |
| `Verified` | `Published` or back to `Draft` | Operations Manager or Super Admin |
| `Published` | `Draft` (reopen) | Operations Manager or Super Admin |

Do not use `Approved` as a status name. The contract word is `Verified`.

Rules:

- Scores are entered only while the sheet is `Draft`.
- A score is from 0 through the sheet maximum, or the student is marked absent.
- Leaving `Draft` requires every active student to have a score or an absent flag.
- Submit locks casual editing. Reopen is a management action and returns the sheet to `Draft`.
- The teacher does not verify or publish.

## Calculated result

When the sheets for a student are in:

- Total marks = sum of maxima.
- Obtained marks = sum of scores.
- Percentage = obtained ÷ total × 100.
- Pass or fail compares each paper, and the overall result, with passing marks.
- Grade, when shown, uses the school scale. Working scale: A+ at 90, then A, B, C, D, F below 50. Treat the scale as configuration if the school replaces it.

Ranks from the baseline (class, subject, overall, exam) are still requirements. Tie policy is not decided. Do not store a rank until that policy exists.

## Documents

DMC, result sheet, mark sheet, class result, and overall examination report are generated from finalized results, previewed, and downloaded as PDF. They are available only to someone allowed to see that result. A parent download is the same gate as the parent screen.

## Parent visibility is not publication

BR-09, BR-10, UR-07.

Publication means the school has finalized the sheet (`Published`). Parent visibility is decided at read time:

```
visible = sheet is Published AND (fee rule passes OR an active override exists)
```

The decision is not stored on the mark row. Hiding a result does not change scores.

Fee rules (`resultVisibility.feeRule`):

| Rule | Parent sees the result when |
|---|---|
| `all_due_paid` | Every fee month up to and including the exam's fee month is paid. Working default. |
| `exam_month_paid` | The exam's fee month is paid. |
| `disabled` | Always, once the sheet is published. |

Only Super Admin changes this setting.

## Override

An authorized user (Super Admin or Operations Manager) may grant one active override per exam and student.

- Store who granted it, when, the student, the exam, and the reason.
- Reason is required while `requireOverrideReason` is true.
- Revoke stores who revoked it and when. It does not delete the grant row.
- Grant and revoke are audited.
- The override never edits marks.
