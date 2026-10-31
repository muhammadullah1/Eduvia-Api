# Migrations

`database/migrations` holds the consolidated schema: one file per table (001–059, in foreign-key
order, generated from the live schema with `pg_dump`) plus `060-drop-legacy-snapshot-tables.js`.
New schema changes go here as new numbered files after 060.

Fresh environments (Stage/production): `npm run db:migrate` then the base-school seed, as in
`docs/DEPLOYMENT-STAGE.md`.

`database/migrations-archive` holds the original 001–088 history. It is kept for reference and
rollback only; sequelize-cli no longer reads it.

## Switch-over (done on dev `creative_leaders_db` and test `eduvia_test_db`, 2026-10-31)

1. Fresh `pg_dump -Fc` of the database, restored into a scratch database and compared
   (row counts per table and data checksums).
2. `SequelizeMeta` copied to `SequelizeMeta_archive` (the 001–088 rows).
3. `SequelizeMeta` rows replaced with the names of files 001–059 in this folder.
4. `npx sequelize db:migrate` then runs only `060`, which drops the two legacy snapshot tables
   (their rows are in a separate `pg_dump -t` taken first).

For any other environment that already ran 001–088, repeat steps 1–4:

```sql
CREATE TABLE "SequelizeMeta_archive" AS SELECT * FROM "SequelizeMeta";
DELETE FROM "SequelizeMeta";
INSERT INTO "SequelizeMeta" (name) VALUES ('001-....js'), ...; -- every file 001–059 in this folder
```

A new, empty database just runs `npx sequelize db:migrate` and then
`npx sequelize db:seed --seed 20261031120000-eduvia-base-school.js` (see the env list in the seeder).

## Rollback

Restore the pre-switch `pg_dump`, or: `DELETE FROM "SequelizeMeta"; INSERT INTO "SequelizeMeta"
SELECT * FROM "SequelizeMeta_archive";`, point `.sequelizerc` back at `migrations-archive`, and
reload the legacy tables from their dump.
