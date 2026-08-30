# CI

## Purpose
GitHub Actions CI pipeline for the backend.

## Ownership
- `workflows/ci.yml` — CI workflow definition

## Local Contracts
- Triggers on push/PR to main/master/develop branches
- Test job boots a `postgres:16-alpine` service, applies the schema (`db.sql`), the production system seed (`seed-prod.sql`), then the demo seed (`seed.sql`) via psql, then runs `npm test`
- Node.js version: 20.x
- No lint job (ESLint is not configured in this repo) and no Docker image build — the shipped deployment is a zip-upload where Node.js and PostgreSQL are installed on first run by `prod.sh`/`prod.ps1` (nothing is bundled)

## Work Guidance

## Verification

## Child DOX Index
(empty)
