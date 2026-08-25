Sera hosted backend — quick start (Ubuntu 22.04/24.04)

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
  --systemd   Install and enable the sera systemd service
  --port N    Override the listening port (default: 4000)
  --seed      Also load seed.sql demo data

Health:            curl http://localhost:4000/health
Booking portal:    http://<host>:4000/book.html?clinic=<slug>
Full runbook:      docs/HOSTING.md
