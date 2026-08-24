# Config

## Purpose
Application configuration modules — database connection, Cloudinary media storage, Swagger API docs, migration runner, error definitions, and structured logging.

## Ownership
- `database.js` — Kysely + pg connection pool setup
- `cloudinary.js` — Cloudinary SDK config
- `swagger.js` — Swagger/OpenAPI spec generation
- `autoMigrate.js`
- `migrations.js` — Migration runner wrapper
- `errors.js` — Custom error classes and codes
- `logger.js` — Winston/structured logger config

## Local Contracts
- All configs read from `process.env` via dotenv; fail fast on missing required vars
- `database.js` throws at require time when `DB_USER`/`DB_NAME`/`DB_PASSWORD` are unset; `DB_PORT` defaults to `5434` (installer/dev standard, not the PG default 5432)
- `database.js` exports a `db` Kysely instance — single source of truth for DB access
- `errors.js` exports `AppError` base class with HTTP statusCode and error code
- `logger.js` exports singleton logger; log level controlled by `LOG_LEVEL` env var; also mirrors lines to `utils/fileSink.js` (file logging, disable with `LOG_FILE=false`)
- `autoMigrate.js` applies pending `migrations/*.up.sql` sequentially at boot and throws on the first failure (the failed migration is not recorded) — never run it concurrently with a manual migrate

## Work Guidance

## Verification

## Child DOX Index
(empty)

