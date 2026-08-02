# Config

## Purpose
Application configuration modules — database connection, Cloudinary media storage, Swagger API docs, migration runner, error definitions, and structured logging.

## Ownership
- `database.js` — Kysely + pg connection pool setup
- `cloudinary.js` — Cloudinary SDK config
- `swagger.js` — Swagger/OpenAPI spec generation
- `migrations.js` — Migration runner wrapper
- `errors.js` — Custom error classes and codes
- `logger.js` — Winston/structured logger config

## Local Contracts
- All configs read from `process.env` via dotenv; fail fast on missing required vars
- `database.js` exports a `db` Kysely instance — single source of truth for DB access
- `errors.js` exports `AppError` base class with HTTP statusCode and error code
- `logger.js` exports singleton logger; log level controlled by `LOG_LEVEL` env var

## Work Guidance

## Verification

## Child DOX Index
(empty)
