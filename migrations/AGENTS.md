# Migrations

## Purpose
Kysely SQL migration files for incremental schema changes applied on top of the full schema in `db.sql`.

## Ownership
- SQL files in `{timestamp}_{sequence}_{name}.up.sql` / `{name}.down.sql` pairs (e.g. `20260613_002_create_prescriptions.up.sql`)
- Migration runner via `scripts/migrate.js`
- **Schema source of truth is `db.sql`** (applied by `recreate-db.*` and CI psql); migrations hold only incremental changes that are NOT yet in `db.sql`

## Local Contracts
- Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS`)
- `up` migrations create/alter schema; `down` migrations revert cleanly
- Migration order determined by filename timestamp prefix; `up` files are `{name}.up.sql`, down files are `{name}.down.sql`
- `npm run migrate` assumes an existing base schema from `db.sql` — it does **not** bootstrap a fresh database; run `recreate-db.*` (or CI psql steps) first
- `scripts/migrate.js` rollback resolves `{name}.up.sql` → `{name}.down.sql`

## Work Guidance

## Verification
- `npm run migrate` runs all pending `up` migrations
- `npm run migrate:down` rolls back the last batch

## Child DOX Index
(empty)
