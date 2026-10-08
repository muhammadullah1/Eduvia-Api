# Security, audit, and reports

Sources: SRS §8, §9, §10, §15.14; P1-07.

## Access

- Login is required for every record, document, and receipt.
- Passwords are hashed. Reset tokens are single purpose and expire.
- A blocked user cannot authenticate.
- Authorization checks the role capability, then the row scope in `access.service`.
- List endpoints apply the same scope as get-by-id. A filtered list that still returns other students' ids is a break of P3-04.
- Accountant collection payloads omit aggregates even if the query could compute them.
- Parent lesson and notice payloads are filtered before they leave the server: lessons `Approved`, notices `Published`, tests `Published`, exam sheets visible only through the fee gate.

## Audit

Write an audit row for:

- student status changes;
- marks finalization, verify, publish, and reopen;
- fee adjustments, generation, allocation, and manual allocation;
- teacher subject changes;
- substitute assign and remove;
- result-visibility grant and revoke;
- daily-test publish and a Failed monthly outcome;
- settings changes;
- notice review when it changes what parents can see.

Each row stores school, actor user, action, entity type, entity id, when, and the before/after or metadata needed to see what changed. IP and user agent may be included. The row is append-only.

`audit.read` is Super Admin.

Login and ordinary reads are not required audit events.

## Reports

Reports are queries over the records in these rules. They do not have their own stored totals.

| Report | Who |
|---|---|
| Dashboard academic, student, exam, fee, and finance cards, and the six baseline graphs | Super Admin. Operations Manager may see the non-financial cards. |
| Student lists, admission trends, promotion and status history | Super Admin, Operations Manager |
| Exam schedule, mark sheet, class result, ranks, DMC | Management; teacher for own subject; parent only through the visibility gate |
| Daily, monthly, class, and student collection; paid, unpaid, outstanding, advance | Super Admin. Accountant sees only their own daily rows, with no total |
| Income, expenses, net | Super Admin |
| Teacher attendance and marks status | That teacher, and management |
| Parent attendance, results, fees, timetable, updates | That parent, linked children only |

## Dashboard

The first screen calculates. It does not write. Cards that the role must not see are omitted on the server, not only hidden in the layout.

## Backups

Backup and recovery are operational requirements from the SRS. They are not a module in the portal.
