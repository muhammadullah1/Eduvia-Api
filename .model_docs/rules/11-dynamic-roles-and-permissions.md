# Roles and permissions: SRS, current state, target dynamic design

Sources: SRS §3, §5, §6, §9, §15.2, §15.9, §15.13 rules (UR-01, UR-07, UR-08, BR-11, BR-14). Current code checked 29 Oct 2026 on `EDUVIA-16`. Status: Phase 1 implemented on `EDUVIA-16` (uncommitted, awaiting owner approval). See "Implemented state" below; earlier sections describe the pre-change code.

## What the SRS says

| Role | SRS | Must | Must not |
|---|---|---|---|
| Super Admin | §15.2 | View, create, edit, configure every module: users, academic setup, students, teachers, timetable, attendance, exams, fees, reports, settings. Overall fee totals and collection reports (§15.9). | — |
| Academic / Operations Manager | §15.2, §15.3–15.8 | Teachers, assignments, attendance, timetable, subjects, classes, admissions, students, exams, results (publish), lessons, planned chapters, daily tests, substitutes, active-subject change. | Fee collection totals and financial controls. |
| Accountant | §15.2, §15.9, BR-11, UR-08 | Record payments; view and print **own** daily detailed collection rows. | Overall collection total, overall financial totals, or a calculated total of **their own** collection. API responses carry no aggregates. |
| Teacher | §5 | Teacher portal: assigned classes/subject (plus substitute periods), attendance, lessons, daily updates, assigned marks (draft/submit). | Other teachers' classes, fee details, management controls/reports. |
| Parent | §6, §15.7–15.11 | Read-only parent portal, linked children only: attendance, published tests, results when fee rule passes or override, fees and receipts, timetable, approved updates. | Any unlinked student; any edit; unpublished/unapproved content. |

Cross-cutting: BR-14 / §15.13 — enforce in interface **and** server; hiding a menu is not enough. §9 — users see only their role's functions and rows. Audit result-visibility overrides, fee allocations, subject changes, substitutes.

### Dynamic permissions in the SRS

The SRS does **not** explicitly require editable roles or a permission editor. The only hints are baseline §3 ("unless granted" for office and exam staff) and the open-question rule to keep unconfirmed choices configurable. Making permissions dynamic is a product decision (multi-tenant SaaS), not a signed requirement. Hard SRS rules below must stay invariants whatever is configured.

## Current implementation

- API: static map `constants/permissions.js` (capability → roles). `middlewares/authorize.js` resolves roles at boot; `authorize_roles.js` checks `req.user.role` (loaded from DB per request). Role is a Postgres enum on `users.role` (migration `003`). No roles or permissions tables, no endpoints to edit them.
- Row scope in services (`accessService.studentScope`, `assertStudentAccess`, teacher class scope, accountant `collections/mine`).
- `middlewares/redact_fee_fields.js` strips fee amounts for roles without `fees.amounts.read` (Ops, Teacher).
- Frontend: `src/lib/permissions.ts` is a hand-mirrored, differently named copy (`fees.status.view`, `settings.fees`, `staff.create.*`). `src/features/shell/navigation.ts` hardcodes nav per role.
- Portals: five separate slugs — `/admin`, `/operations`, `/accountant`, `/teacher`, `/parent`. Ops and Accountant do **not** log into the Super Admin portal today; they get their own portal shells with hardcoded menus.
- Settings → Roles & Permissions (`src/features/settings/components/roles-panel.tsx`): **read-only** matrix from the FE copy, text says "fixed school roles … per-user grants are not part of this product".

## Gaps

| # | Gap |
|---|---|
| G1 | Permissions are code constants; no per-school configuration. |
| G2 | FE and API matrices have different keys and can drift; FE nav is not driven by the server. |
| G3 | Ops/Accountant use separate portals, not the Super Admin portal with limited access (owner's stated target). |
| G4 | Roles page is read-only. |
| G5 | No audit of permission changes (none exist yet). |
| G6 | SRS invariants (accountant no totals, Ops/Teacher fee redaction, parent own-child) live partly in the matrix — a naive editor could grant them away. |
| G7 | Accountant "Families" and Ops "Families" nav still present though concessions simplification may remove families. |

## Target design (proposed)

1. **Catalog** — `permissions` table seeded from `constants/permissions.js` (key, module, label, description, `risk` level, `grantable_to` list). Code keeps the constants as the catalog source; a seeder syncs keys. Routes still call `authorize("key")`; unknown keys fail at boot.
2. **Roles per school** — `roles` (school_id, key, label, `is_system`, `portal`: `admin` | `teacher` | `parent`) and `role_permissions` (role_id, permission_key). Seed the five system roles per school with exactly today's matrix. `users.role` stays (or gains `fk_role_id`) during migration.
3. **Portals** — Super Admin, Ops, Accountant (and any future custom staff role) use the one `/admin` portal; nav items are shown only when the user holds the item's permission. Teacher and Parent keep their own portals; their roles are not editable into staff permissions.
4. **Editor** — Settings → Roles & Permissions becomes an editable matrix (Super Admin only, `roles.manage`), grouped by module, with diff preview, reason required, and "reset to default".
5. **Locked invariants (cannot be granted, enforced in code, not the matrix)**:
   - Super Admin keeps every permission; cannot be edited or removed; at least one active Super Admin per school.
   - `fees.totals`, `finance.reports`, `income.*` — Super Admin only (SRS §15.9). Accountant responses never contain aggregates even if a permission is toggled (service-level check stays).
   - Teacher: no fee capabilities; row scope to own classes. Parent: read-only, linked children only, results gated by fee rule.
   - Ops/Teacher fee redaction stays unless the role explicitly holds `fees.amounts.read`, which is non-grantable to teacher.
   - `roles.manage`, `settings.fees.update`, `fees.payments.allocate_manual` — Super Admin only.
6. **Enforcement** — `authorize(key)` looks up `role_permissions` via a per-school cache (in-memory map keyed by school+role with version stamp; invalidated on write). Row scope and invariant checks remain in services.
7. **Session API** — `GET /auth/me` returns the effective permission list; FE `can()` and nav read it instead of the local copy (delete the FE mirror).
8. **Audit** — every role/permission change logged (who, school, role, added/removed keys, reason).
9. **Tenant isolation** — roles and grants filtered by `req.user.schoolId`; tests prove school A cannot read or edit school B's roles.
10. **Migration** — seed each existing school so the effective matrix equals today's constants exactly; snapshot test compares before/after per role; no behaviour change on day one.

## Open questions

- Custom roles (e.g. "Admissions clerk"), or only edit the five system roles?
- Per-user overrides, or role-level only? (Current UI text says no per-user grants.)
- Should Ops/Accountant move into the `/admin` portal (owner's direction) — confirm the separate `/operations` and `/accountant` portals are retired.
- May a school grant Ops fee status / amounts? SRS only bars totals and financial controls.

## Implemented state (EDUVIA-16 Phase 1, 30 Oct 2026)

- **Catalog:** `permissions` table (migration 080) seeded from `Eduvia-Api/constants/permissions.js` (key, module, label, description, risk, assignable roles). `authorize()` with an unknown key throws at startup.
- **Per-school roles:** `roles` (081) and `role_permissions` (082), school-scoped; 083 seeds the 5 system roles for every school with exactly the previous static map (snapshot test proves day-one equality). No custom roles or per-user grants yet; schema allows them later. `users.role` stays an enum.
- **Locked invariants (code, not data):** Super Admin always holds every permission and each school keeps ≥1 active Super Admin; SA-only keys (fee totals, finance reports, income, roles.manage, fee settings, manual allocation, payment confirm, bill adjustments, concession approval, fee structure update, expense edit) cannot be granted; sign-in keys (`account.self`, `school.read`) cannot be revoked; Teacher/Parent are revoke-only. Locks are returned per key with a reason (`lockReason`) and enforced by the API (400 on a locked grant). Service-level redaction (accountant no totals, Ops/Teacher fee amounts redacted, parent own-child + publish/fee gates) is independent of grants.
- **Enforcement:** `authorize(...keys)` reads effective permissions from a per-process cache keyed by school+role, invalidated on save/reset. Multi-instance deployments need a shared cache or short TTL (open decision).
- **Session:** login and `GET /auth/me` return `permissions`. The FE stores them (zustand), refreshes `/auth/me` on focus and every 60 s, and drives sidebar, routes, buttons and data-slice loading from them (`useCan`, `canNow`, `SLICE_READ_PERMISSIONS`). `src/lib/permissions.ts` is deleted; `PermissionKey` is generated from the API catalog (`scripts/generate-permission-keys.mjs`).
- **Single staff portal:** Super Admin, Operations Manager and Accountant use `/admin`; sections are filtered by `requires`/`hiddenWith`. Old `/operations/*`, `/accountant/*` and legacy sections (`overview`, `collect`, `settings-roles`, `?panel=roles`) redirect. A non-permitted section renders an in-app 403 with "Go to my home page".
- **Roles & Permissions page** (`/admin/roles`, `roles.manage`): role cards (users, permission counts), users sheet with change-role dialog, per-role editor with module cards (switch, Sensitive badge, action chips, lock + tooltip reason), sticky Discard/Update bar, diff preview with required reason (5–500 chars), Reset to default, optimistic-concurrency `version` (409 on conflict), Activity tab.
- **Audit:** every save, reset and user role change writes an audit entry (actor, school, role, added, removed, reason; from → to for users), visible in the Activity tab and Audit Trail.
