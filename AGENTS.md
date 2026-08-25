# Dentacore Backend

## Purpose
Node.js/Express REST API for the Algerian Dental Management System. Serves as the data and business logic layer for the JavaFX frontend.

## Ownership
- `server.js` — Entry point (starts Express + Socket.IO + appointment reminder scheduler)
- `src/app.js` — Express app factory
- `src/socket.js` — Socket.IO real-time event bus
- `src/config/` — Database, Swagger, Cloudinary, migration, error, and logger config
- `src/middleware/` — Auth, audit, rate limiting, error handling, response formatting
- `src/routes/` — 19 entity route modules + `publicBookings.js` (public booking portal)
- `src/services/` — Business logic (notifications, reminder scheduling)
- `src/utils/` — CSV, logger, pagination, upload, availability helpers
- `src/__tests__/` — Jest test suite (runs against a seeded local DB; `jest.setup.js` forces `NODE_ENV=test` to bypass rate limiting)
- `migrations/` — Kysely SQL migrations (incremental changes on top of `db.sql`)
- `scripts/` — DB recreate, seed, migrate utilities
- `.github/workflows/ci.yml` — CI pipeline (bootstraps the DB from `db.sql` + `seed.sql` via psql, then runs `npm run migrate` and `npm test`; no Docker image build)
- `db.sql` — Full schema source of truth (applied via `recreate-db.*` and CI)

## Local Contracts
- Route responses are returned bare (arrays/objects directly via `res.json`); `src/middleware/responseFormatter.js` exists but is **not mounted** in `src/app.js` — do not claim a `{ data, meta }` envelope on the wire
- Auth via JWT bearer tokens, middleware in `auth.js`; access/refresh expiry defaults to `24h`/`7d` when `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` are unset
- Rate limiting applied to all mutation routes via `rateLimiter.js` — `apiLimiter` (60/min) and `mutationLimiter` (30/min) are mounted **before** the routers in `src/app.js`; `mutationLimiter` counts mutation methods only (GET/HEAD/OPTIONS skip); both are bypassed when `NODE_ENV=test`
- Audit logging via `auditLogger.js` middleware (capped at 1000 entries)
- Stack traces hidden in production (`NODE_ENV=production`); production 500s also return the generic `error.internal_server` key and fire an optional `ERROR_WEBHOOK_URL` alert
- Logs mirror to `logs/backend.log` with size rotation (`LOG_FILE=false` disables); server applies pending migrations at boot when `AUTO_MIGRATE=true`; unhandled rejections are logged and uncaught exceptions trigger graceful shutdown
- Swagger docs production-guarded (disabled when `NODE_ENV=production`)
- Database access via Kysely query builder with PostgreSQL
- All migration scripts read `DB_PASSWORD` from `.env`; no hardcoded credentials
- **No Docker path**: `Dockerfile`/`docker-compose.yml`/`.dockerignore` are removed — the backend runs natively (bundled Node + PostgreSQL via `setup-backend.ps1`, or `recreate-db.*` for dev)
- **Public booking surface (prototype)**: `/api/v1/public/:clinic/*` (see `routes/AGENTS.md`) + `public/book.html` portal page served by `express.static('public')`; clinic = tenant `subdomain` slug; availability driven by the `working_hours` table (in `db.sql`); demo data via `node scripts/seed-demo-clinic.js` then open `/book.html?clinic=clinic-demo`. Prototype schema changes go straight into `db.sql` — no migration ledger entries while prototyping
- **Default ports (durable)**: API HTTP `4000` (`PORT`; fallback in `server.js`), PostgreSQL `5434` (`DB_PORT`; installer default in `setup-backend.ps1`, dev fallback in `recreate-db.*` and `test-db-connection.js`). Frontend base URL defaults to `http://localhost:4000/` (`Service.java`, overridable via `-Ddentacore.api.url`). Dev CORS fallback includes `http://localhost:4000`
- Internet deployment runbook: `docs/HOSTING.md`

## Work Guidance

## Verification
- `npm test` runs Jest suite (supertest-based API tests) — 170 pass across 14 files (incl. `publicBooking.test.js`)
- `npm run migrate` and `npm run migrate:down` for migration verification (`migrate:down` reverts exactly one migration per invocation)
- SonarQube real-scan (projectVersion 1.3): bugs 0, vulnerabilities 0, code_smells 14, reliability_rating 1.0

## Child DOX Index
- `src/config/` — Database, Cloudinary, Swagger, migrations, error, and logger configuration
- `src/middleware/` — Express middleware: auth, audit, rate limiting, tenant-by-slug, error handler, response formatter
- `src/routes/` — API route definitions for the 19 entity types + public booking portal
- `src/services/` — Business logic services (notifications, reminder scheduling)
- `src/utils/` — Shared utilities: CSV, logger, pagination, file upload, availability
- `src/__tests__/` — Jest test suite with 14 test files
- `migrations/` — Kysely SQL migration files
- `scripts/` — Database recreate, seed, and migration scripts
- `.github/` — CI workflow
