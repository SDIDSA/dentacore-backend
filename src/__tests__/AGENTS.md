# Tests

## Purpose
Jest test suite for backend API endpoints, RBAC, multi-tenancy, and business logic.

## Ownership
- `api.test.js` — General API endpoint tests (CRUD for core entities)
- `auditLogs.test.js` — Audit log retrieval tests
- `dashboard.test.js` — Dashboard aggregation endpoint tests
- `multitenancy.test.js` — Multi-tenancy isolation tests
- `rbac.test.js` — Role-based access control tests
- `reports.test.js` — Report endpoint tests
- `treatmentPlans.test.js` — Treatment plan status workflow tests

## Local Contracts
- Tests use supertest against the Express app (no live server)
- Auth tokens generated via test helper for each role (admin, dentist, receptionist)
- Each test file cleans up after itself

## Work Guidance

## Verification
- `npm test` from project root runs the full Jest suite

## Child DOX Index
(empty)
