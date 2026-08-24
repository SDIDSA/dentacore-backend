# CI

## Purpose
GitHub Actions CI pipeline for the backend.

## Ownership
- `workflows/ci.yml` — CI workflow definition

## Local Contracts
- Triggers on push/PR to main/master/develop branches
- Test job boots a `postgres:16-alpine` service, applies the full schema (`db.sql`) and seed (`seed.sql`) via psql, then runs `npm run migrate` (exercises the migration path against a fresh baseline) followed by `npm test`
- Node.js version: 20.x
- Lint job runs `npx eslint src/ --ext .js` (continue-on-error)
- No Docker image build — the Docker path was removed; the shipped deployment is native (bundled Node + PostgreSQL)

## Work Guidance

## Verification

## Child DOX Index
(empty)
