# Scripts

## Purpose
Maintenance and utility scripts for database management and seeding.

## Ownership
- `recreate-db.cmd` / `recreate-db.sh` — Drop and recreate the database (schema + seed)
- `seed-sql.js` — Runner that delegates to `recreate-db.cmd`/`.sh`
- `seed.sql` — SQL seed data for 3 demo clinics (El-Qods ~100 patients/396 appointments, Sourire trial, Teyar personal)
- `migrate.js` — Migration runner for up/down operations
- `test-db-connection.js` — Database connection test script

## Local Contracts
- Recreate scripts read `DB_PASSWORD` and `DB_PORT` (default `5434`) from `.env` or prompt interactively; all psql calls pass `-p %DB_PORT%` — never hardcode the port in the script body
- Seeded admin credentials: `admin@elqods.dz` / `Admin@2025!` and `admin@sourire.dz` / `Sourire@2025!` (the old `admin@dental-clinic.dz` / `Admin@123456` values printed by deploy scripts were stale and have been corrected)
- Schema is in `db.sql`, seed data in `seed.sql` (both at project root)
- All scripts are run from project root

## Work Guidance

## Verification

## Child DOX Index
(empty)
