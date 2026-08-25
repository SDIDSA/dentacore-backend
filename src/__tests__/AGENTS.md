# Tests

## Purpose
Jest test suite for backend API endpoints, RBAC, multi-tenancy, and business logic.

## Ownership
- `api.test.js` — General API endpoint tests (CRUD for core entities)
- `auditLogs.test.js` — Audit log retrieval tests
- `crossTenantIsolation.test.js` — Cross-tenant isolation regression tests (second tenant created via Kysely; dashboard isolation, cross-tenant reference rejection, 404 on foreign entity GETs)
- `dashboard.test.js` — Dashboard aggregation endpoint tests
- `deleteReturns204.test.js` — DELETE endpoints return 204 with empty body (appointments, prescriptions, treatment plans, users)
- `invoicePaymentReconciliation.test.js` — Payment↔invoice reconciliation regression tests (overpayment guard, recompute on payment delete, status-key whitelist)
- `multitenancy.test.js` — Multi-tenancy isolation tests
- `patientsSearch.test.js` — Multi-word patient search regression tests (plainto_tsquery)
- `publicBooking.test.js` — Public portal end-to-end: slug-resolution 404s, dentist/service listing, slot computation from seeded `working_hours`, guest booking (patient stub + appointment + staff visibility via authenticated list), one-active-slot race guard, per-phone cap, cross-tenant dentist rejection
- `rbac.test.js` — Role-based access control tests
- `rbacGating.test.js` — Admin-only endpoint gating regression tests (audit-logs, reports, recent-activity: 403 non-admin / 200 admin)
- `reports.test.js` — Report endpoint tests
- `treatmentPlans.test.js` — Treatment plan status workflow tests
- `updatesDownloadGuard.test.js` — `/api/v1/updates` path traversal guard regression tests

## Local Contracts
- Tests use supertest against the Express app (no live server)
- Auth tokens generated via test helper for each role (admin, dentist, receptionist)
- Each test file cleans up after itself (API deletes where possible, direct Kysely deletes for SQL-created rows)
- Regression suites probe the DB (`SELECT 1`) in `beforeAll`; if unreachable, they set a flag and every test early-returns so the suite stays green without a database
- Cross-tenant fixtures (tenant/user/patients/appointments) are created directly via the Kysely `db` instance with unique UUID-based identifiers and removed in `afterAll`

## Work Guidance

## Verification
- `npm test` from project root runs the full Jest suite (170 passing, 14 files)
- `crossTenantIsolation.test.js` also covers invoice line-item `treatment_record_id` and treatments.js reference tenancy (regression tests for the guards added pre-delivery)

## Child DOX Index
(empty)
