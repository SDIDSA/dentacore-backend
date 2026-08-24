# Scripts

## Purpose
Maintenance and utility scripts for database management and seeding.

## Ownership
- `recreate-db.cmd` / `recreate-db.sh` — Drop and recreate the database (schema + seed); live at the **project root**, not in `scripts/`
- `seed-sql.js` — Runner that delegates to `recreate-db.cmd`/`.sh`
- `seed.sql` — SQL seed data for 3 demo clinics (El-Qods ~100 patients/396 appointments, Sourire trial, Teyar personal)
- `migrate.js` — Migration runner for up/down operations
- `test-db-connection.js` — Database connection test script
- `restore-db.ps1` — Windows restore script for nightly backups (ships to `{app}\backend\scripts` via installer packaging); takes a `.dump` path, reads credentials from `{app}\backend\.env`, requires `-Yes` (alias `-ConfirmBackup`, kept for compatibility) or typed `RESTORE` confirmation (destructive: `pg_restore --clean --if-exists`), and always attempts a safety pre-restore dump first
- `force-rls.js` — Guarded stub: refuses to run unless `ENABLE_FORCE_RLS=true`; FORCE RLS with no policies default-denies all access including the table owner, so policies must exist first
- `verify-multitenancy.js` — Proves the app-layer tenant_id discriminator (no RLS exists; session vars are no-ops); asserts zero foreign-tenant rows in scoped selects and EXITS NON-ZERO on failure (CI-usable)

## Local Contracts
- Recreate scripts read `DB_PASSWORD` and `DB_PORT` (default `5434`) from `.env` or prompt interactively; all psql calls pass `-p %DB_PORT%` — never hardcode the port in the script body
- On re-run with an existing `dentacore` user, both recreate scripts ROTATE the user password via `ALTER USER` so a changed `DB_PASSWORD` in `.env` wins (the `.sh` previously only attempted CREATE and silently kept the old password)
- Passwords are never echoed to the console; the password interpolated into `CREATE USER ... PASSWORD '<pw>'` is SQL-escaped by doubling single quotes (`''`) before use
- PowerShell DB scripts (`restore-db.ps1`) pass passwords only via the `PGPASSWORD` environment variable — never command-line arguments; no hardcoded credentials; pg_dump/pg_restore resolve from `{BackendDir}\pgsql\bin`
- Seeded admin credentials: `admin@elqods.dz` / `Admin@2025!` and `admin@sourire.dz` / `Sourire@2025!` (the old `admin@dental-clinic.dz` / `Admin@123456` values printed by deploy scripts were stale and have been corrected)
- Schema is in `db.sql`, seed data in `seed.sql` (both at project root)
- All scripts are run from project root

## Work Guidance

## Verification

## Child DOX Index
(empty)
