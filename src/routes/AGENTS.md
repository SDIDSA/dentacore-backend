# Routes

## Purpose
Express route handlers for all 19 API entity types. Each route module defines CRUD + search endpoints.

## Ownership
- `appointments.js` — Appointment scheduling CRUD
- `auditLogs.js` — Audit log retrieval (read-only)
- `auth.js` — Login, token refresh, logout
- `dashboard.js` — Dashboard aggregation endpoints
- `expenses.js` — Expense tracking CRUD
- `inventory.js` — Inventory items, categories, suppliers, stats, alerts
- `invoices.js` — Invoice and billing CRUD
- `media.js` — File/image upload and management via Cloudinary
- `notifications.js` — Notification creation and retrieval
- `odontogram.js` — Dental chart data CRUD
- `patients.js` — Patient CRUD + import/export CSV
- `payments.js` — Payment recording CRUD
- `prescriptions.js` — Prescription/eRx CRUD with RX-numbering
- `purchaseOrders.js` — Purchase order CRUD
- `reports.js` — Aggregated report endpoints
- `treatmentPlans.js` — Treatment plan CRUD with status workflow
- `treatments.js` — Individual treatment record CRUD
- `users.js` — User/staff account CRUD
- `xrays.js` — X-ray image CRUD

## Local Contracts
- All mutation routes have rate limiting applied (mutationLimiter 30/min, apiLimiter 60/min) — limiters are mounted **before** the routers in `src/app.js`; `mutationLimiter` counts mutation methods only (GET/HEAD/OPTIONS skip), and both are bypassed when `NODE_ENV=test`
- CRUD entity routes implement GET list, GET /:id, POST, PATCH, DELETE, GET /batch; read-only modules (auditLogs, dashboard, reports) expose only retrieval endpoints
- Search input sanitized on `/search` endpoints via regex `[^a-zA-Z0-9\s\-]`
- Responses are bare (`res.json`); `responseFormatter` is not mounted
- Routes use `express-validator` for input validation
- `auth.js` routes are the only unauthenticated endpoints (login/refresh)
- Odontogram uses non-standard routing (patient-scoped, not entity-scoped)
- **DELETE returns 204 no-content uniformly** (including users delete and changePassword) — clients declare `Call<Void>`
- **Admin-gated modules**: `auditLogs.js` and `reports.js` wholesale via `authorize('auth.role.admin')`; dashboard `/recent-activity` per-route; `users.js` wholesale
- **FK tenancy validation**: POST/PATCH handlers verify every accepted entity reference (`patient_id`, etc.) belongs to `req.tenantId` before writing; cross-tenant references get a generic validation error (no existence leak)
- **Money integrity**: payment create/PATCH/DELETE recompute invoice `paid_amount_dzd`/`payment_status_key` inside a transaction with row locks; PATCH enforces the same overpayment guard as POST; the direct `PATCH invoices/:id/payment` endpoint rejects `paid_amount_dzd > total_dzd` (same invariant); RX numbers generated inside a transaction under `pg_advisory_xact_lock` (+ UNIQUE `(tenant_id, prescription_number)` backstop)
- **Search hygiene**: full-text search uses `plainto_tsquery('simple', …)`; non-search `ilike` filters escape `%`, `_`, `\` from user input
- CSV exports neutralize formula injection via `sanitizeCsvValue` (`utils/csv.js`) on user-entered fields

## Work Guidance

## Verification

## Child DOX Index
(empty)
