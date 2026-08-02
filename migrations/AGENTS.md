# Migrations

## Purpose
Kysely SQL migration files for database schema evolution. Supports up/down migration.

## Ownership
- SQL files in timestamp-named format (e.g., `20231001_initial.sql`)
- Migration runner via `scripts/migrate.js`

## Local Contracts
- Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS`)
- `up` migrations create/alter schema; `down` migrations revert cleanly
- Migration order determined by filename timestamp prefix
- Schema includes: users, patients, appointments, treatments, invoices, payments, expenses, inventory items/categories/suppliers, prescriptions, treatment_plans, xrays, notifications, audit_logs

## Work Guidance

## Verification
- `npm run migrate` runs all pending `up` migrations
- `npm run migrate:down` rolls back the last batch

## Child DOX Index
(empty)
