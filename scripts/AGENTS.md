# Scripts

## Purpose
Maintenance and utility scripts for database management and seeding.

## Ownership
- `recreate-db.cmd` / `recreate-db.sh` — Drop and recreate the database (schema + seed)
- `seed-sql.js` — Runner that delegates to `recreate-db.cmd`/`.sh`
- `seed.sql` — SQL seed data for 3 demo clinics (~100 patients, 300+ appointments)
- `migrate.js` — Migration runner for up/down operations
- `test-db-connection.js` — Database connection test script

## Local Contracts
- Recreate scripts read `DB_PASSWORD` from `.env` or prompt interactively
- Schema is in `db.sql`, seed data in `seed.sql` (both at project root)
- All scripts are run from project root

## Work Guidance

## Verification

## Child DOX Index
(empty)
