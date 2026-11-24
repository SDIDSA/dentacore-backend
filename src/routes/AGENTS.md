# Routes

## Purpose
Express route handlers for the API: 19 authenticated entity modules + 2 public modules (booking, signup) + 1 platform-operator module. Each route module defines CRUD + search endpoints.

## Ownership
- `appointments.js` — Appointment scheduling CRUD (supports optional `category_id` linked to `treatment_categories` acts/procedures)
- `auditLogs.js` — Audit log retrieval (read-only)
- `auth.js` — Login, token refresh, logout, self-service `PATCH /password` (any role; requires `current_password`, rejects an unchanged password, rate-limited)
- `cashRegisterSessions.js` — Cash register sessions (caisse shifts) CRUD (`POST /` open float, `GET /active`, `POST /:id/close` reconciliation with discrepancy math, `GET /`, `GET /batch`, `GET /:id`)
- `clientLogs.js` — Remote client crash reporting & log tracking (`/api/v1/client-logs` and alias `/api/v1/crashes`): unauthenticated rate-limited `POST /` ingestion, `GET /stats`, `GET /` (paginated, filtered), `GET /:id` (full stack trace), `PATCH /:id` (resolve/notes), `DELETE /:id` (deletion); clinic admins see own tenant, platform admin sees cross-tenant & pre-login crashes
- `clinic.js` — The caller's own clinic: `GET /` profile (any staff), `PATCH /` name/address/phone/email (admin; non-name fields in `tenants.settings.profile`), `GET /working-hours` (any staff), `PUT /working-hours` (admin) → `utils/clinicHours.js`
- `creditNotes.js` — Credit notes (Avoirs) CRUD (`POST /`, `GET /`, `GET /batch`, `GET /:id`) with `CN-YYYYMM-NNNN` auto-numbering, amount-guarded against invoice paid amount
- `dashboard.js` — Dashboard aggregation endpoints
- `expenses.js` — Expense tracking CRUD
- `inventory.js` — Inventory items, categories, suppliers, stats, alerts
- `invoices.js` — Invoice and billing CRUD (generic PATCH strips direct balance edits; DELETE blocked when payments exist; `PATCH /:id/payment` deleted)
- `media.js` — File/image upload and management via Cloudinary
- `notifications.js` — Notification creation and retrieval; `GET /` and `GET /unread-count` accept `?exclude_types=a,b` (per-user mutes from the desktop client; `^[a-z_]+$` entries only)
- `odontogram.js` — Dental chart data CRUD (FDI teeth 11–85 whitelisted, adult + deciduous quadrants; `POST /condition` for direct condition upsert)
- `patients.js` — Patient CRUD + import/export CSV
- `payments.js` — Payment recording CRUD (`DELETE /payments/:id` returns HTTP 405; refunds issued via credit notes)
- `prescriptions.js` — Prescription/eRx CRUD with RX-numbering (multi-drug line items via `prescription_items` with legacy fallback)
- `publicBookings.js` — Public web booking portal API (unauthenticated; see contract below)
- `signup.js` — Public clinic self-signup (unauthenticated; see contract below)
- `platform.js` — Operator console API (cross-tenant; see contract below)
- `purchaseOrders.js` — Purchase order CRUD
- `reports.js` — Aggregated report endpoints
- `treatmentPlans.js` — Treatment plan CRUD with status workflow
- `treatments.js` — Individual treatment record CRUD with Bill of Materials (BOM) inventory depletion on `clinical_act_id`; exposes `GET /categories` for global and tenant clinical acts
- `users.js` — User/staff account CRUD (admin-only, incl. `PATCH /:id/password` to reset someone else's password); create / role change / status change call `syncDentistHours` so dentists' `working_hours` follow the clinic hours
- `webBookings.js` — Staged web booking requests from public portal: `GET /` (list/filter), `GET /pending-count`, `GET /:id`, `POST /:id/approve` (converts to official patient and appointment), `POST /:id/reject`
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
  - endpoints: `GET /:clinic/dentists` (id+name only), `GET /:clinic/services` (global + own treatment categories), `GET /:clinic/slots?date=YYYY-MM-DD[&dentist_id=]` (availability from `working_hours` minus booked and pending web bookings, Africa/Algiers wall clock, ≤31 days ahead), `POST /:clinic/bookings`
  - POST stages the booking request in `web_bookings` (`status_key = 'web_booking.status.pending'`) with client guest info (name, phone, notes) and requested appointment date/dentist/category. It does NOT create patient or appointment records in `patients` or `appointments` directly.
  - guards: `strictMutationLimiter` router-wide, max 1 upcoming booking per phone across active appointments and pending web bookings, and unique index `uq_web_booking_pending_slot` arbitrates slot races → `409 public.booking.slot_taken`
  - errors use `public.booking.*` keys; responses never echo other tenants' data
- **`webBookings.js` provides staff workflow for staged web appointments**:
  - `GET /api/v1/web-bookings` returns staged bookings with joins on dentist and category; accepts `?status=pending|approved|rejected`.
  - `GET /api/v1/web-bookings/pending-count` returns `{ count }` for fast notification badges.
  - `POST /api/v1/web-bookings/:id/approve` executes an atomic transaction: checks for existing patient with matching phone or creates new `patients` row with sequential `PAT-YYYY-XXXX` code, creates confirmed `appointments` row (`appt.status.confirmed`), updates `web_bookings` status to `approved`, and emits real-time events.
  - `POST /api/v1/web-bookings/:id/reject` updates status to `rejected` with optional `rejection_reason`.
- **`signup.js` is the third intentionally-unauthenticated surface** — `POST /api/v1/signup` creates a trial tenant (30-day `subscription_ends_at`) + its `auth.role.admin` user in one transaction; guards: own `signupLimiter` (10/hour/IP, test-bypassed), in-transaction uniqueness checks → `409 signup.error.subdomain_taken` / `signup.error.email_taken`, reserved-slug denylist (www/api/app/admin/book/signup/…), schema-format validation (subdomain regex, `+213` phone, password ≥ 8). Served page: `public/signup.html` + `signup.js`. The client's login screen links here (`App.SIGNUP_URL`)
- **`platform.js` is the cross-tenant operator surface (durable)** — router-wide `authenticate` + `authorize('auth.role.platform_admin')`; a role no clinic account holds. Deliberately ignores the tenant discriminator: `GET /stats` (platform totals), `GET /tenants` (search/status filter + pagination + correlated per-tenant user/patient/appointment counts), `GET /tenants/:id` (detail + users), `PATCH /tenants/:id` (whitelisted fields only: name, subscription_status (enum-checked), subscription_plan, subscription_ends_at, is_active). Mounted with `mutationLimiter` in `app.js`. Served page: `public/platform.html` + `platform.js`; operator account provisioned by `scripts/create-platform-admin.js` under the reserved `sera-platform` tenant. Role seeds (incl. `auth.role.platform_admin`) live in `seed-prod.sql` (idempotent `ON CONFLICT DO NOTHING`) — not just seed.sql
- **Remote crash logging surface**: `POST /api/v1/client-logs` (alias `/api/v1/crashes`) ingests desktop and mobile crash reports. Accepts unauthenticated posts (pre-login crashes) with `strictMutationLimiter` rate-limiting, extracts tenant and user from JWT or body if available. Persists in `client_crashes` table. Review surface (`GET /stats`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`) is tenant-scoped for clinic admins and cross-tenant for platform operators on the Operator Console (`public/platform.html` Tab 10).
- Odontogram uses non-standard routing (patient-scoped, not entity-scoped)
- **DELETE returns 204 no-content uniformly** on entities permitting hard-delete; `DELETE /payments/:id` returns 405 Method Not Allowed (payments cannot be hard-deleted; issue credit note), `DELETE /invoices/:id` returns 400 if settled payments exist
- **Admin-gated modules**: `auditLogs.js` and `reports.js` wholesale via `authorize('auth.role.admin')`; dashboard `/recent-activity` per-route; `users.js` wholesale
- **FK tenancy validation**: POST/PATCH handlers verify every accepted entity reference (`patient_id`, etc.) belongs to `req.tenantId` before writing; cross-tenant references get a generic validation error (no existence leak)
- **Money integrity**: payment create/PATCH recompute invoice `paid_amount_dzd`/`payment_status_key` inside a transaction with row locks; payment hard-deletion is blocked (HTTP 405); generic invoice PATCH strips `paid_amount_dzd` and recomputes total on discount updates; `DELETE /invoices/:id` is rejected with 400 if payments exist; refunds/adjustments are recorded via `credit_notes` (`/api/v1/credit-notes`); shift cash balance and reconciliation tracked via `cash_register_sessions` (`/api/v1/cash-register-sessions`); RX numbers generated inside a transaction under `pg_advisory_xact_lock` with multi-drug line items inserted into `prescription_items` (+ UNIQUE `(tenant_id, prescription_number)` backstop)
- **Search hygiene**: full-text search uses `plainto_tsquery('simple', …)`; non-search `ilike` filters escape `%`, `_`, `\` from user input
- CSV exports neutralize formula injection via `sanitizeCsvValue` (`utils/csv.js`) on user-entered fields
- **Audit action contract (durable)**: `req.audit.log` emits only `CREATE` / `UPDATE` / `DELETE` — specialized mutations log as `UPDATE` and carry the distinction in `old_values`/`new_values` (expense/PO status endpoints: `status_key` change; PO receive-items: `items_received` present; inventory adjust-stock: `current_stock` delta + `adjustment`/`reason`). Never introduce new action strings; the frontend derives subtypes from the diff.
- **Treatment BOM inventory depletion**: `POST /api/v1/treatments` accepts optional `clinical_act_id`. In an atomic transaction, the treatment record is saved and any linked consumables from `clinical_act_materials` create `stock_movements` rows (`movement_type = 'OUT'`), automatically deducting `inventory_items.current_stock` via DB trigger. `GET /treatments`, `GET /treatments/:id`, and `GET /batch` include `clinical_act_id`.
- **Odontogram condition upsert**: `POST /api/v1/odontogram/condition` allows atomic upsert of patient tooth condition and notes (`{ patient_id, tooth_number, condition, notes }`) without requiring full-chart replacement.

## Work Guidance

## Verification

## Child DOX Index
(empty)
