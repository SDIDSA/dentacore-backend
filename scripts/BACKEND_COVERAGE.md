# Sera — Frontend ↔ Backend Endpoint Coverage Audit

Full cross-reference of every endpoint the **desktop JavaFX client** (`dentacore/`) declares or
calls against the complete **backend inventory** (`dentacore-backend/src/routes/*`). Generated
by reading every Retrofit service interface in
`dentacore/src/main/java/com/sdidsa/dentacore/api/online/services/` and the full backend route
inventory (see `E2E_FLOW.md`).

Base path for all entity APIs: `/api/v1`. The client's Retrofit baseURL is
`Service.API_URL = BASE_URL + "api/v1/"` (from `pom.xml` `<api.url>`). Every call carries
`Authorization: Bearer` + `x-refresh-token`, with `x-access-token`/`x-refresh-token` response
headers captured for in-session token rotation.

Legend: **✓ used** (client calls it) · **declared, no caller** (interface exists but no screen
invokes it) · **backend-only** (no client interface) · n/a (not applicable).

---

## Auth / Session

| Endpoint | Client | Notes |
|---|---|---|
| `POST /auth/login` | ✓ | `LoginForm.submit`; stores tokens + session in LocalStore |
| `GET /auth/validate` | ✓ | `App.verifyToken` on startup (session restore) |
| `POST /auth/logout` | ⚠ declared, **not called** | `App.logout()` clears tokens locally only; never hits the API |

## Patients

| Endpoint | Client |
|---|---|
| `GET /patients` | ✓ |
| `GET /patients/batch` | ✓ |
| `GET /patients/search` | ✓ |
| `GET /patients/:id` | ✓ |
| `POST /patients` | ✓ |
| `PATCH /patients/:id` | ✓ |
| `PATCH /patients/:id/status` | ✓ |
| `DELETE /patients/:id` | ✓ |
| `GET /patients/:id/detail` | ✓ |
| `GET /patients/export` | ⚠ declared, **no caller found** |
| `POST /patients/import` | backend-only (admin tool) |

## Staff / Users

| Endpoint | Client |
|---|---|
| `GET /users` | ✓ |
| `GET /users/batch` | ✓ |
| `GET /users/search` | ✓ |
| `GET /users/:id` | ✓ |
| `GET /users/meta/roles` | ✓ |
| `POST /users` | ✓ |
| `PATCH /users/:id` | ✓ |
| `PATCH /users/:id/status` | ✓ |
| `PATCH /users/:id/password` | ✓ |
| `DELETE /users/:id` | ✓ |

## Appointments

| Endpoint | Client |
|---|---|
| `GET /appointments` | ✓ (multi-status filters on schedule) |
| `GET /appointments/range` | ✓ day/week/month + dashboard "today" |
| `GET /appointments/batch` | ✓ |
| `GET /appointments/search` | ✓ |
| `GET /appointments/:id` | ✓ |
| `POST /appointments` | ✓ |
| `PATCH /appointments/:id` | ✓ |
| `PATCH /appointments/:id/status` | ✓ |
| `DELETE /appointments/:id` | ✓ |

## Treatments / Plans / Odontogram

| Endpoint | Client |
|---|---|
| `GET /treatments` | ✓ |
| `GET /treatments/batch` | ✓ |
| `GET /treatments/search` | ✓ |
| `GET /treatments/:id` | ✓ |
| `POST /treatments` | ✓ |
| `PATCH /treatments/:id` | ✓ |
| `DELETE /treatments/:id` | ✓ |
| `GET /treatment-plans` | ✓ |
| `GET /treatment-plans/batch` | ✓ |
| `GET /treatment-plans/search` | ✓ |
| `GET /treatment-plans/:id` | ✓ |
| `POST /treatment-plans` | ✓ |
| `PATCH /treatment-plans/:id` | ✓ |
| `DELETE /treatment-plans/:id` | ✓ |
| `POST /treatment-plans/:id/treatments` | ✓ (attach) |
| `DELETE /treatment-plans/:id/treatments/:tid` | ✓ (detach)¹ |
| `GET /odontogram/:patientId` | ✓ |
| `PUT /odontogram/:patientId/tooth/:tooth` | ✓ |
| `DELETE /odontogram/:patientId/tooth/:tooth` | ✓ |

¹ `DELETE` returns **200 `{success:true}`**, not 204 — the client keeps the response type.

## Billing — Invoices

| Endpoint | Client |
|---|---|
| `GET /invoices` | ✓ |
| `GET /invoices/batch` | ✓ |
| `GET /invoices/search` | ✓ |
| `GET /invoices/:id` | ✓ |
| `POST /invoices` | ✓ (line items create-only) |
| `PATCH /invoices/:id` | ✓ (header fields only, matching contract) |
| `PATCH /invoices/:id/status` | backend-only² |
| `PATCH /invoices/:id/payment` | backend-only² |

² The client edits invoices via the generic `PATCH /invoices/:id` (which accepts
`paid_amount_dzd`/`payment_status_key`), so the dedicated `/status` and `/payment` sub-routes
are unused by the desktop app though present in the API.

## Payments

| Endpoint | Client |
|---|---|
| `GET /payments` | ✓ |
| `GET /payments/batch` | ✓ |
| `GET /payments/search` | ✓ |
| `GET /payments/:id` | ✓ |
| `POST /payments` | ✓ (canonical create, `PaymentService`) |
| `PATCH /payments/:id` | ✓ |
| `DELETE /payments/:id` | ✓ |

## Expenses

| Endpoint | Client |
|---|---|
| `GET /expenses` | ✓ |
| `GET /expenses/batch` | ✓ |
| `GET /expenses/search` | ✓ |
| `GET /expenses/:id` | ✓ |
| `POST /expenses` | ✓ |
| `PATCH /expenses/:id` | ✓ |
| `PATCH /expenses/:id/status` | ✓ |
| `DELETE /expenses/:id` | ✓ |

## Inventory

| Endpoint | Client |
|---|---|
| `GET /inventory/items` | ✓ |
| `GET /inventory/items/batch` | ✓ |
| `GET /inventory/items/search` | ✓ |
| `GET /inventory/items/:id` | ✓ |
| `POST /inventory/items` | ✓ |
| `PATCH /inventory/items/:id` | ✓ |
| `DELETE /inventory/items/:id` | ✓ |
| `POST /inventory/items/:id/adjust-stock` | backend-only³ |
| `GET /inventory/items/:id/movements` | backend-only³ |
| `GET /inventory/categories` · `/batch` · `/:id` | ✓ |
| `POST /inventory/categories` | ✓ |
| `PATCH /inventory/categories/:id` | ✓ |
| `DELETE /inventory/categories/:id` | ✓ |
| `GET /inventory/suppliers` · `/batch` · `/:id` | ✓ |
| `POST /inventory/suppliers` | ✓ |
| `PATCH /inventory/suppliers/:id` | ✓ |
| `DELETE /inventory/suppliers/:id` | ✓ |
| `GET /inventory/reports/low-stock` | ✓ (dashboard/inventory stats) |
| `GET /inventory/stats` | backend-only |
| `GET /inventory/reports/valuation` | backend-only |

³ Stock adjust/movements exist in the API but the desktop client currently adjusts stock only
via the item edit panel → `PATCH /inventory/items/:id` (it does not call `adjust-stock` or read
`movements`). Verify against the item editor if stock adjustments are surfaced there.

## Purchase Orders

| Endpoint | Client |
|---|---|
| `GET /purchase-orders` | ✓ |
| `GET /purchase-orders/batch` | ✓ |
| `GET /purchase-orders/search` | ✓ |
| `GET /purchase-orders/:id` | ✓ |
| `POST /purchase-orders` | ✓ |
| `PATCH /purchase-orders/:id` | ✓ (notes/delivery/shipping/supplier only) |
| `PATCH /purchase-orders/:id/status` | ✓ |
| `DELETE /purchase-orders/:id` | ✓ |
| `PATCH /purchase-orders/:id/receive` | backend-only (receive goods) |

## Prescriptions

| Endpoint | Client |
|---|---|
| `GET /prescriptions` · `/batch` · `/search` · `/:id` | ✓ |
| `POST /prescriptions` | ✓ |
| `PATCH /prescriptions/:id` | ✓ |
| `DELETE /prescriptions/:id` | ✓ |

## X-Rays / Media

| Endpoint | Client |
|---|---|
| `GET /xrays?patient_id=` | ✓ |
| `GET /xrays/batch` · `/search` · `/:id` | ✓ |
| `POST /xrays/upload` | ✓ (multipart; online-only) |
| `PATCH /xrays/:id` | ✓ |
| `DELETE /xrays/:id` | ✓ |
| `GET /media` · `/batch` · `/search` · `/:id` | ✓ (machinery exists) |
| `POST /media/upload` | ⚠ declared, **no caller** (X-rays upload via `/xrays/upload`) |
| `PATCH /media/:id` · `DELETE /media/:id` | ⚠ declared; no page surfaces media CRUD |

## Dashboard / Reports / Audit / Notifications

| Endpoint | Client |
|---|---|
| `GET /dashboard/appointments/today` | ✓ |
| `GET /dashboard/patients/raw` · `/appointments/raw` · `/treatments/raw` · `/payments/raw` | ✓ |
| `GET /dashboard/recent-activity` | ✓ (admin) |
| `GET /reports/revenue/monthly` | ✓ |
| `GET /reports/revenue/by-method` | ✓ |
| `GET /reports/procedures/frequency` | ✓ |
| `GET /reports/patients/new` | ✓ |
| `GET /reports/appointments/stats` | ✓ |
| `GET /reports/plans/summary` · `/dentist/stats` · `/revenue/export` | backend-only (no client screen) |
| `GET /audit-logs` · `/batch` · `/:id` | ✓ (admin viewer) |
| `GET /notifications` · `/unread-count` | ✓ (bell + 30s badge poll) |
| `PUT /notifications/:id/read` · `/read-all` | ✓ |
| `DELETE /notifications/:id` · `POST /notifications/delete-batch` | backend-only (no client UI) |

## Not part of the desktop client (browser/website surfaces)

- **Signup**: `POST /api/v1/signup` — called by `public/signup.js`; the desktop login screen
  only links out to it (`App.SIGNUP_URL` → `/signup.html`), never calls the API.
- **Public booking portal**: `/api/v1/public/:clinic/*` (dentists/services/slots/bookings) —
  called by `public/book.js`, not the client.
- **Platform operator console**: `/api/v1/platform/*` — called by `public/platform.js`
  (`auth.role.platform_admin`), not the client.
- **Non-API HTTP**: `GET /health` (NetworkManager connectivity heartbeat, ~30s), Cloudinary CDN
  image fetch (MediaProxy), GitHub Releases update check.

---

## Flags / discrepancies to resolve before shipping

1. **`POST /auth/logout` is never called** — the client clears tokens locally. After a logout,
   the (now-blacklisted-able) refresh token stays un-revoked server-side. Consider calling
   logout on exit, or intentionally accept this.
2. **`GET /patients/export`** declared but unused — no UI triggers CSV export.
3. **`POST /media/upload` + media CRUD** declared but unused — X-ray upload goes through
   `/xrays/upload`; the standalone media page/list machinery has no consumer screen.
4. **No `/stats/*` client calls** — dashboard figures are computed client-side from entity
   lists (`/patients`, `/appointments/range`, `/treatments`, `/invoices`, `/inventory/items`,
   `/inventory/reports/low-stock`). Stale `StatisticsService` comment blocks referencing
   `/stats/appointments|treatments|revenue` describe non-existent endpoints — safe to delete.
5. **Inventory `adjust-stock`/`movements`** may be unused — confirm the item editor doesn't need
   the dedicated endpoints; if it should, add the Retrofit calls.
6. **`PATCH /invoices/:id/payment` and `/status`** unused by the client (uses generic PATCH) —
   fine, but the dedicated endpoints are the only ones enforcing the overpayment guard at the
   sub-route level (the generic PATCH relies on the DB CHECK; see E2E_FLOW.md Phase 7 note).

The `e2e-flow.js` script exercises the endpoints the **desktop and web** clients rely on plus
the backend-only surfaces, so running it green is a strong signal that the whole API matches
the client contracts.
