# Routes

## Purpose
Express route handlers for the API: 19 authenticated entity modules + 2 public modules (booking, signup) + 1 platform-operator module. Each route module defines CRUD + search endpoints.

## Ownership
- `appointments.js` — Appointment scheduling CRUD
- `auditLogs.js` — Audit log retrieval (read-only)
- `auth.js` — Login, token refresh, logout, self-service `PATCH /password` (any role; requires `current_password`, rejects an unchanged password, rate-limited)
- `clinic.js` — The caller's own clinic: `GET /` profile (any staff), `PATCH /` name/address/phone/email (admin; non-name fields in `tenants.settings.profile`), `GET /working-hours` (any staff), `PUT /working-hours` (admin) → `utils/clinicHours.js`
- `dashboard.js` — Dashboard aggregation endpoints
- `expenses.js` — Expense tracking CRUD
- `inventory.js` — Inventory items, categories, suppliers, stats, alerts
- `invoices.js` — Invoice and billing CRUD
- `media.js` — File/image upload and management via Cloudinary
- `notifications.js` — Notification creation and retrieval; `GET /` and `GET /unread-count` accept `?exclude_types=a,b` (per-user mutes from the desktop client; `^[a-z_]+$` entries only)
- `odontogram.js` — Dental chart data CRUD
- `patients.js` — Patient CRUD + import/export CSV
- `payments.js` — Payment recording CRUD
- `prescriptions.js` — Prescription/eRx CRUD with RX-numbering
- `publicBookings.js` — Public web booking portal API (unauthenticated; see contract below)
- `signup.js` — Public clinic self-signup (unauthenticated; see contract below)
- `platform.js` — Operator console API (cross-tenant; see contract below)
- `purchaseOrders.js` — Purchase order CRUD
- `reports.js` — Aggregated report endpoints
- `treatmentPlans.js` — Treatment plan CRUD with status workflow
- `treatments.js` — Individual treatment record CRUD
- `users.js` — User/staff account CRUD (admin-only, incl. `PATCH /:id/password` to reset someone else's password); create / role change / status change call `syncDentistHours` so dentists' `working_hours` follow the clinic hours
- `xrays.js` — X-ray image CRUD

## Local Contracts
- All mutation routes have rate limiting applied (default mutationLimiter 180/min, apiLimiter 600/min, strictMutationLimiter 30/min; configurable via env vars) — limiters are mounted **before** the routers in `src/app.js`; `mutationLimiter` and `strictMutationLimiter` count mutation methods only (GET/HEAD/OPTIONS skip), OPTIONS preflights, /health, and static assets are unthrottled, and all are bypassed when `NODE_ENV=test`
- CRUD entity routes implement GET list, GET /:id, POST, PATCH, DELETE, GET /batch; read-only modules (auditLogs, dashboard, reports) expose only retrieval endpoints
- Search input sanitized on `/search` endpoints via regex `[^a-zA-Z0-9\s\-]`
- Responses are bare (`res.json`); `responseFormatter` is not mounted
- Routes use `express-validator` for input validation
- `appointments.js` slot overlap queries in POST and PATCH explicitly cast client timestamps to `::timestamptz` on both boundaries to prevent ASCII string comparison mismatches against PostgreSQL calculated intervals
- `auth.js` login/refresh are unauthenticated; **`publicBookings.js` is the other intentionally-unauthenticated surface** — its contract:
  - mounted at `/api/v1/public`, every path starts with `/:clinic` = the tenant's `subdomain` slug, resolved by `tenantBySlug` into `req.tenantId`; unknown/malformed slugs get the SAME generic 404 (`public.clinic_not_found`) so the namespace can't be probed
  - endpoints: `GET /:clinic/dentists` (id+name only), `GET /:clinic/services` (global + own treatment categories), `GET /:clinic/slots?date=YYYY-MM-DD[&dentist_id=]` (availability from `working_hours` minus booked, Africa/Algiers wall clock, ≤31 days ahead), `POST /:clinic/bookings`
  - POST creates a guest patient stub (name + phone only; dob/gender nullable) with the standard `PAT-YYYY-NNNN` code and the appointment atomically in a single transaction; the request time must exactly match a currently-free slot
  - guards: `strictMutationLimiter` router-wide, max 1 upcoming booking per phone, and schema-level `uq_appt_active_slot` (unique dentist+start among active statuses) arbitrates races → `409 public.booking.slot_taken` (transaction rolls back cleanly, leaving no orphaned patient stub)
  - errors use `public.booking.*` keys; responses never echo other tenants' data
- **`signup.js` is the third intentionally-unauthenticated surface** — `POST /api/v1/signup` creates a trial tenant (30-day `subscription_ends_at`) + its `auth.role.admin` user in one transaction; guards: own `signupLimiter` (10/hour/IP, test-bypassed), in-transaction uniqueness checks → `409 signup.error.subdomain_taken` / `signup.error.email_taken`, reserved-slug denylist (www/api/app/admin/book/signup/…), schema-format validation (subdomain regex, `+213` phone, password ≥ 8). Served page: `public/signup.html` + `signup.js`. The client's login screen links here (`App.SIGNUP_URL`)
- **`platform.js` is the cross-tenant operator surface (durable)** — router-wide `authenticate` + `authorize('auth.role.platform_admin')`; a role no clinic account holds. Deliberately ignores the tenant discriminator: `GET /stats` (platform totals), `GET /tenants` (search/status filter + pagination + correlated per-tenant user/patient/appointment counts), `GET /tenants/:id` (detail + users), `PATCH /tenants/:id` (whitelisted fields only: name, subscription_status (enum-checked), subscription_plan, subscription_ends_at, is_active). Mounted with `mutationLimiter` in `app.js`. Served page: `public/platform.html` + `platform.js`; operator account provisioned by `scripts/create-platform-admin.js` under the reserved `sera-platform` tenant. Role seeds (incl. `auth.role.platform_admin`) live in `seed-prod.sql` (idempotent `ON CONFLICT DO NOTHING`) — not just seed.sql
- Odontogram uses non-standard routing (patient-scoped, not entity-scoped)
- **DELETE returns 204 no-content uniformly** (including users delete and changePassword) — clients declare `Call<Void>`
- **Admin-gated modules**: `auditLogs.js` and `reports.js` wholesale via `authorize('auth.role.admin')`; dashboard `/recent-activity` per-route; `users.js` wholesale
- **FK tenancy validation**: POST/PATCH handlers verify every accepted entity reference (`patient_id`, etc.) belongs to `req.tenantId` before writing; cross-tenant references get a generic validation error (no existence leak)
- **Money integrity**: payment create/PATCH/DELETE recompute invoice `paid_amount_dzd`/`payment_status_key` inside a transaction with row locks; PATCH enforces the same overpayment guard as POST; the direct `PATCH invoices/:id/payment` endpoint rejects `paid_amount_dzd > total_dzd` (same invariant); RX numbers generated inside a transaction under `pg_advisory_xact_lock` (+ UNIQUE `(tenant_id, prescription_number)` backstop)
- **Search hygiene**: full-text search uses `plainto_tsquery('simple', …)`; non-search `ilike` filters escape `%`, `_`, `\` from user input
- CSV exports neutralize formula injection via `sanitizeCsvValue` (`utils/csv.js`) on user-entered fields
- **Audit action contract (durable)**: `req.audit.log` emits only `CREATE` / `UPDATE` / `DELETE` — specialized mutations log as `UPDATE` and carry the distinction in `old_values`/`new_values` (expense/PO status endpoints: `status_key` change; PO receive-items: `items_received` present; inventory adjust-stock: `current_stock` delta + `adjustment`/`reason`). Never introduce new action strings; the frontend derives subtypes from the diff.

## Work Guidance

## Verification

## Child DOX Index
(empty)
