# Migrations

## Purpose
Kysely SQL migration files for incremental schema changes applied on top of the full schema in `db.sql`.

## Ownership
- SQL files in `{timestamp}_{sequence}_{name}.up.sql` / `{name}.down.sql` pairs (e.g. `20260613_002_create_prescriptions.up.sql`)
- Migration runner via `scripts/migrate.js`
- **Schema source of truth is `db.sql`** (applied by `recreate-db.*` and CI psql); migrations hold only incremental changes that are NOT yet in `db.sql`

## Local Contracts
- Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS`; guard unguarded `ALTER TABLE ... ADD CONSTRAINT` in a `DO $$ pg_constraint $$` block)
- `down` migrations must never drop objects owned by the `db.sql` baseline (e.g. `prescriptions`) — revert only what that migration exclusively created (trigger/functions/constraints); use a commented safe no-op when nothing exclusive remains
- `up` migrations must apply cleanly on a fresh `db.sql` load with an empty ledger (CI runs `npm run migrate` right after psql bootstrap)
- Migration order determined by filename timestamp prefix; `up` files are `{name}.up.sql`, down files are `{name}.down.sql`
- `npm run migrate` assumes an existing base schema from `db.sql` — it does **not** bootstrap a fresh database; run `recreate-db.*` (or CI psql steps) first
- `scripts/migrate.js` rollback resolves `{name}.up.sql` → `{name}.down.sql`
- Ledger records SHA-256 checksums at apply time but never verifies them on re-run

## Work Guidance

## Verification
- `npm run migrate` runs all pending `up` migrations
- `npm run migrate:down` rolls back exactly **one** migration (the most recent ledger entry); run it repeatedly to step further back — it does not roll back a whole batch

## Child DOX Index
(empty)
