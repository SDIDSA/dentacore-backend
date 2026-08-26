Sera hosted backend — quick start

[Ubuntu 22.04/24.04]

  1. unzip sera-backend-<version>.zip
  2. cd sera-backend
  3. sudo bash deploy/setup.sh --systemd

setup.sh handles everything:
  - Installs Node.js 22 (via nodesource) if missing or < 20
  - Installs PostgreSQL if missing, starts the service
  - Creates the database + role, applies the schema
  - Generates .env with auto-generated secrets (DB_PASSWORD, JWT keys)
  - Optionally installs a systemd service (--systemd)

Options:
  --systemd       Install and enable the sera systemd service
  --port N        Override the listening port (default: 4000)
  --seed          Also load seed.sql demo data
  --backup-cron   Nightly pg_dump + retention + audit trim (optionally rclone offsite)

[Windows Server 2019+ / Windows 10+]

  1. unzip sera-backend-<version>.zip
  2. cd sera-backend
  3. powershell -NoProfile -ExecutionPolicy Bypass -File deploy\setup.ps1 -Service

setup.ps1 handles everything (winget installs of Node.js/PostgreSQL when missing,
secrets generation, role + database creation, idempotent schema, Scheduled Task
service). The postgres superuser password is only prompted for when the role or
database must be created.

Options:
  -Service        Register the API as a SYSTEM Scheduled Task (auto-start)
  -Port N         Override the listening port (default: 4000)
  -Seed           Also load seed.sql demo data
  -BackupCron     Nightly pg_dump + retention + audit trim (SYSTEM task, 02:30)
  -OffsiteRemote  rclone destination for offsite dump copies

Health:            curl http://localhost:4000/health
Site:              http://<host>:4000/          (marketing + signup)
Booking portal:    http://<host>:4000/book.html?clinic=<slug>
Full runbook:      docs/HOSTING.md
