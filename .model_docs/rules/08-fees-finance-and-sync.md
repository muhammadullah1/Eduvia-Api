# Fees, finance, and offline sync

Sources: SRS §4.5, §4.6, §4.7, §6.5, §10, §15.9, §15.10; P1-05, P1-06, P1-08; UR-08, UR-09; BR-11, BR-12.

## Fee month

One row per student, per month (`YYYY-MM`), per fee type.

Working default type is tuition. The baseline still allows more types (admission, exam, annual, transport, other) once the school confirms them. Do not invent extra charges.

Amount due comes from the class monthly fee. If the class has none, use `fees.defaultMonthlyFee`.

| Status | Meaning |
|---|---|
| `Unpaid` | Nothing allocated, and the month is due |
| `Partially Paid` | Some amount allocated, less than the amount due |
| `Paid` | Allocated amount covers the amount due |
| `Advance` | A future month that is already fully covered |

Status is derived from amounts. Do not let a client send a status that disagrees with paid versus due.

Generation fills every active student from the ledger start through the target month, with no gaps. Ledger start is the later of the admission month and the current session start. Withdrawn students do not get new months.

Outstanding = total due to date − total paid to date − advance already applied.

## Payment

A payment stores: school, student, receipt number, amount, date, method, who recorded it, notes, idempotency key, allocation mode (`auto` or `manual`), and any amount not yet placed on a month.

Methods: `Cash`, `BankTransfer`, `Cheque`, `Online`.

Amount is greater than zero.

Receipt numbers are unique per school. Shape: `RCPT-YYYYMMDD-NNN`.

Idempotency key is unique. The same key returns the original payment and does not allocate again.

## Allocation — oldest unpaid first

BR-12, UR-09.

Default mode is `auto`:

1. Lock the student's open months (`SELECT … FOR UPDATE` plus an advisory lock `fees:{studentId}`).
2. Walk months from oldest to newest.
3. Fill each open balance before touching the next month.
4. If money remains, create advance months up to `fees.maxAdvanceMonths` (default 12) and fill those oldest-first as well.
5. Anything still left stays on the payment as unallocated credit. It is not dropped and it is not a second payment.

A one-month payment while January, February, and March are unpaid marks January first. February and March stay unpaid and stay visible.

Parents see every unpaid month, not a collapsed balance.

Manual allocation (`fees.payments.allocate_manual`) is Super Admin only. It must not exceed a month's open balance or the payment amount. It is audited as `manual`. It is the only way to skip oldest-first.

Confirming a pending payment runs the same allocator. It does not create a second receipt.

## Who sees money

BR-11, UR-08.

| Actor | May see |
|---|---|
| Accountant | Payments they recorded. Daily table: student name, admission number, date, months, amount, receipt. Print that table and individual receipts. No grand total in the UI or the JSON. |
| Parent | Their children's months, status, outstanding, advance, and receipts. |
| Operations Manager | Per-student paid / unpaid status. Not school collection totals. |
| Super Admin | Totals, search across receipts, manual allocation, finance. |

Fee income on the finance side is derived from payments. Nobody types fee income a second time.

## Receipt

A receipt prints the student, class, date, method, recorder, each allocation, unallocated credit, and the amount. It does not print a school-wide running total.

## Offline sync

P1-08. Still required. The current frontend simulation is not the feature.

Template columns: admission number, student name (display only), class, month or months, amount, payment date, receipt or reference, method, notes.

Before any write, each row is checked:

| Check | Fail |
|---|---|
| Student exists and is enrolled | Unknown or inactive id |
| Month is a real fee period for that class | Bad period |
| Amount is positive | Zero, negative, or blank |
| Receipt or reference not already imported | Skip as duplicate, do not error as a second payment |
| Required fields present | Row fails |

Valid rows go through the same allocator as a counter payment. Invalid rows return a reason. The summary reports success, skipped, and failed counts, plus the timestamp. Running the same file twice must not create a second payment.

## Finance

- Other income and expenses are entered, with category, amount, date, and description.
- Staff cost is an expense category. It is not a payroll run.
- Expense categories cover utilities, supplies, maintenance, and similar.
- Total income, total expenses, and net status are sums of the entries for the period. They are not stored totals.
- Finance screens and expense management are Super Admin. Recording an expense may also be the accountant, without school-wide net figures.

## Parent fee examples the demos rely on

These are fixtures, not extra rules. A parent with three unpaid months sees all three. The next one-month payment clears the oldest only.
