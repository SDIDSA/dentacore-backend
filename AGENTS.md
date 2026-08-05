# Dentacore Backend

## Purpose
Node.js/Express REST API for the Algerian Dental Management System. Serves as the data and business logic layer for the JavaFX frontend.

## Ownership
- `server.js` — Entry point (starts Express + Socket.IO + appointment reminder scheduler)
- `app.js` — Express app factory
- `socket.js` — Socket.IO real-time event bus
- `src/config/` — Database, Swagger, Cloudinary, migration, error, and logger config
- `src/middleware/` — Auth, audit, rate limiting, error handling, response formatting
- `src/routes/` — 19 entity route modules
- `src/services/` — Business logic (notifications, reminder scheduling)
- `src/utils/` — CSV, logger, pagination, upload helpers
- `__tests__/` — Jest test suite
- `migrations/` — Kysely SQL migrations
- `scripts/` — DB recreate, seed, migrate utilities
- `.github/workflows/ci.yml` — CI pipeline

## Local Contracts
- All route responses use `responseFormatter` wrapper: `{ data, meta }` shape
- Auth via JWT bearer tokens, middleware in `auth.js`
- Rate limiting applied to all mutation routes via `rateLimiter.js`
- Audit logging via `auditLogger.js` middleware (capped at 1000 entries)
- Stack traces hidden in production (`NODE_ENV=production`)
- Swagger docs production-guarded (disabled when `NODE_ENV=production`)
- Database access via Kysely query builder with PostgreSQL
- All migration scripts read `DB_PASSWORD` from `.env`; no hardcoded credentials

## Work Guidance

## Verification
- `npm test` runs Jest suite (supertest-based API tests) — 123/123 pass
- `npm run migrate` and `npm run migrate:down` for migration verification
- SonarQube real-scan (projectVersion 1.3): bugs 0, vulnerabilities 0, code_smells 14, reliability_rating 1.0

## Child DOX Index
- `config/` — Database, Cloudinary, Swagger, migrations, error, and logger configuration
- `middleware/` — Express middleware: auth, audit, rate limiting, error handler, response formatter
- `routes/` — API route definitions for all 19 entity types
- `services/` — Business logic services (notifications, reminder scheduling)
- `utils/` — Shared utilities: CSV, logger, pagination, file upload
- `__tests__/` — Jest test suite with 8 test files
- `migrations/` — Kysely SQL migration files
- `scripts/` — Database recreate, seed, and migration scripts
- `.github/` — CI workflow
