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

## Work Guidance

## Verification

## Child DOX Index
(empty)
