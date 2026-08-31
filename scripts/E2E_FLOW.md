# Sera Backend — End-to-End Request Flow Map

A single ordered `admin` journey that exercises **every** main function and entity endpoint
on the backend. It mirrors what the JavaFX client does screen-by-screen, in dependency order
(you cannot bill a patient you haven't created, etc.). The runnable counterpart is
`e2e-flow.js` in this directory.

Base URL for everything: `{API_BASE}/api/v1` (default `http://localhost:4000/api/v1`).

Auth model:
- Most requests carry `Authorization: Bearer <accessToken>`.
- The client also sends `x-refresh-token` and `X-Client-Timestamp`; on `401 TokenExpiredError`
  the client auto-refreshes and the response returns fresh `x-access-token`/`x-refresh-token`
  headers. `e2e-flow.js` implements this rotation.
- Roles: `auth.role.admin`, `auth.role.dentist`, `auth.role.receptionist`, `auth.role.platform_admin`.

Response style: bare JSON (no `{data,meta}` envelope) except paginated list endpoints, which
return `{ data: [ids], total, limit, offset }` **only when `?limit=` is present**.

---

## Phase 0 — Provision a throwaway clinic (public, no auth)

| # | Method | Path | Body / query | Expected | Backend module |
|---|--------|------|--------------|----------|----------------|
| 0.1 | `GET` | `/health` | — | `200 {status:'ok'}` | `app.js` |
| 0.2 | `GET` | `/api/version` | — | `200 {version:'v1',current:true}` | `app.js` |
| 0.3 | `POST` | `/api/v1/signup` | `{ clinic_name, subdomain, full_name, email, password, phone }` (`phone` = `+213…` E.164, unique subdomain/email) | `201 { tenant:{name,subdomain}, trial_ends_at }` | `signup.js` |

Creates the tenant (`tenant.status.trial`, 30-day trial) + its `auth.role.admin` user in one
transaction. This is the same self-signup the website's `/signup` page performs and that the
desktop login screen links out to (`App.SIGNUP_URL`).

> **e2e note:** the signup-created admin is what we use for the whole flow. If you'd rather
> test against an existing tenant instead of creating one, the script supports a
> `--no-signup` flag + literal `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` (see script header).

---

## Phase 1 — Auth / session

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 1.1 | `POST` | `/auth/login` | `{ email, password }` | `200 { accessToken, refreshToken, id, fullName, roleKey, roleKeys, tenantId }` | Login |
| 1.2 | `GET` | `/auth/validate` | (Bearer) | `200` same shape (session restore on app start) | App start |

(Logout `POST /auth/logout` exists; the desktop client currently clears tokens locally and
does **not** call it — flagged in the coverage report.)

---

## Phase 2 — Staff / users (admin)

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 2.1 | `GET` | `/users/meta/roles` | — | `200 [{ id, role_key, description }]` (role ids needed below) | Staff page |
| 2.2 | `POST` | `/users` | `{ email, password, full_name, phone(+213…), role_ids:[<int>] }` | `201` staff account | Staff edit panel |
| 2.3 | `POST` | `/users` | second staff (e.g. a `dentist`) | `201` | Staff edit panel |
| 2.4 | `GET` | `/users` | — | `200 [ids]` | Staff list |
| 2.5 | `GET` | `/users/batch?ids=…` | — | `200 [objects]` | Staff details |
| 2.6 | `PATCH` | `/users/:id` | `{ role_ids:[…], full_name }` | `200` | Staff edit |
| 2.7 | `PATCH` | `/users/:id/status` | `{ status_key }` | `200` (active↔disabled) | Staff list menu |
| 2.8 | `PATCH` | `/users/:id/password` | `{ new_password }` | `204` (change own or staff pw) | Profile / Staff edit |
| 2.9 | `GET` | `/users/search?search=…` | — | `200 [ids]` | Global search |
| 2.10 | `DELETE` | `/users/:id` | — | `204` (last-admin guard) | Staff delete |

---

## Phase 3 — Patients

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 3.1 | `POST` | `/patients` | `{ full_name, date_of_birth, gender, phone(+213…), address, medical_history, … }` | `201` (code `PAT-YYYY-NNNN`) | Patient add |
| 3.2 | `POST` | `/patients` | second patient | `201` | Patient add |
| 3.3 | `GET` | `/patients` | — | `200 [ids]` | Patient list |
| 3.4 | `GET` | `/patients/batch?ids=…` | — | `200 [objects]` | Patient details |
| 3.5 | `GET` | `/patients/:id` | — | `200` full record (+ last/next visit) | Patient detail |
| 3.6 | `PATCH` | `/patients/:id` | `{ phone, medical_history, … }` | `200` | Patient edit |
| 3.7 | `PATCH` | `/patients/:id/status` | `{ status_key }` | `200` | Patient list menu |
| 3.8 | `GET` | `/patients/:id/detail` | — | `200 { patient, appointments, treatments, invoices, plans }` | Patient detail tab |
| 3.9 | `GET` | `/patients/search?search=…` | — | `200 [ids]` | Global search |
| 3.10 | `GET` | `/patients/export` | — | `200` CSV | Patient export (client currently unused) |
| 3.11 | `POST` | `/patients/import` | multipart `file` (CSV ≤5MB) | `201 { created, errors, total }` | (backend/admin) |
| 3.12 | `DELETE` | `/patients/:id` | — | `204` (blocked if invoiced) | Patient delete |

---

## Phase 4 — Inventory (categories → suppliers → items → stock)

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 4.1 | `POST` | `/inventory/categories` | `{ category_key, description }` | `201` | Inventory settings |
| 4.2 | `GET` | `/inventory/categories` | — | `200 [ids]` | Inventory |
| 4.3 | `GET` | `/inventory/categories/batch?ids=…` | — | `200 [objects]` | Inventory |
| 4.4 | `POST` | `/inventory/suppliers` | `{ name, phone, payment_terms_days, … }` | `201` | Inventory settings |
| 4.5 | `GET` | `/inventory/suppliers` | — | `200 [ids]` | Inventory |
| 4.6 | `GET` | `/inventory/suppliers/:id` | — | `200` | Inventory |
| 4.7 | `POST` | `/inventory/items` | `{ name, unit_of_measure, unit_cost_dzd, min_stock_level, current_stock, selling_price_dzd, category_id }` | `201` (+ initial stock movement) | Item add |
| 4.8 | `POST` | `/inventory/items` | second item | `201` | Item add |
| 4.9 | `GET` | `/inventory/items` | — | `200 [ids]` | Inventory list |
| 4.10 | `GET` | `/inventory/items/batch?ids=…` | — | `200 [objects]` | Inventory |
| 4.11 | `PATCH` | `/inventory/items/:id` | `{ unit_cost_dzd, min_stock_level, … }` | `200` | Item edit |
| 4.12 | `POST` | `/inventory/items/:id/adjust-stock` | `{ quantity, reason }` | `200` (movement `adjustment`, updates stock) | Item edit |
| 4.13 | `GET` | `/inventory/items/:id/movements` | — | `200 [ids]` | Item detail |
| 4.14 | `GET` | `/inventory/reports/low-stock` | — | `200 [items]` | Dashboard / Inventory stats |
| 4.15 | `GET` | `/inventory/stats` | — | `200 { total_items, active_items, low_stock_items, total_inventory_value_dzd, … }` | (backend) |
| 4.16 | `GET` | `/inventory/reports/valuation` | — | `200 { items, summary }` | (backend) |
| 4.17 | `GET` | `/inventory/items/search?search=…` | — | `200 [ids]` | Global search |
| 4.18 | `DELETE` | `/inventory/items/:id` | — | `204` | Item delete |

---

## Phase 5 — Appointments

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 5.1 | `POST` | `/appointments` | `{ patient_id, dentist_id, appointment_date(ISO), duration_minutes, reason }` | `201` (overlap → `409 appointment.error.overlap`) | Schedule add |
| 5.2 | `POST` | `/appointments` | second appointment | `201` | Schedule add |
| 5.3 | `GET` | `/appointments/range?start_date=&end_date=` | — | `200 [ids]` | Day/week/month + dashboard today |
| 5.4 | `GET` | `/appointments` | `?status_key=&date=` | `200 [ids]` | Schedule / list |
| 5.5 | `GET` | `/appointments/batch?ids=…` | — | `200 [objects]` | Schedule |
| 5.6 | `GET` | `/appointments/:id` | — | `200` | Schedule |
| 5.7 | `PATCH` | `/appointments/:id/status` | `{ status_key }` (→ completed) | `200` | Schedule menu |
| 5.8 | `PATCH` | `/appointments/:id` | `{ duration_minutes, notes }` | `200` | Schedule edit |
| 5.9 | `GET` | `/appointments/search?search=…` | — | `200 [ids]` | Global search |
| 5.10 | `DELETE` | `/appointments/:id` | — | `204` (blocked if invoiced) | Schedule delete |

---

## Phase 6 — Treatments + Treatment plans + Odontogram

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 6.1 | `POST` | `/treatment-plans` | `{ patient_id, plan_name, description, estimated_total_dzd }` | `201` | Plan add |
| 6.2 | `GET` | `/treatment-plans` | — | `200 [ids]` | Plans list |
| 6.3 | `GET` | `/treatment-plans/batch?ids=…` | — | `200 [objects]` | Plans |
| 6.4 | `GET` | `/treatment-plans/:id` | — | `200 { plan, treatments }` | Plan detail |
| 6.5 | `POST` | `/treatments` | `{ patient_id, diagnosis, treatment_performed, estimated_cost_dzd, treatment_date, tooth_number, plan_id }` | `201` (FDI `tooth_number`) | Treatment add / history |
| 6.6 | `POST` | `/treatments` | second treatment | `201` | Treatment add |
| 6.7 | `GET` | `/treatments` | — | `200 [ids]` | History page |
| 6.8 | `GET` | `/treatments/batch?ids=…` | — | `200 [objects]` | History |
| 6.9 | `POST` | `/treatment-plans/:id/treatments` | `{ treatment_id }` (attach to plan) | `200/201` | Plan edit |
| 6.10 | `GET` | `/odontogram/:patientId` | — | `200 { patient_id, teeth, summary, quadrants }` | Odontogram page |
| 6.11 | `PUT` | `/odontogram/:patientId/tooth/:toothNumber` | `{ condition, notes }` | `200` | Odontogram edit |
| 6.12 | `DELETE` | `/odontogram/:patientId/tooth/:toothNumber` | — | `200 {success:true}` | Odontogram edit |
| 6.13 | `GET` | `/treatments/search?search=…` | — | `200 [ids]` | Global search |
| 6.14 | `PATCH` | `/treatments/:id` | `{ treatment_performed, notes }` | `200` | Treatment edit |
| 6.15 | `PATCH` | `/treatment-plans/:id` | `{ status_key, plan_name }` | `200` | Plan status |
| 6.16 | `GET` | `/treatment-plans/search?search=…` | — | `200 [ids]` | Global search |
| 6.17 | `DELETE` | `/treatments/:id` | — | `204` | Treatment delete |
| 6.18 | `DELETE` | `/treatment-plans/:id` | — | `204` | Plan delete |

---

## Phase 7 — Billing: invoices → payments → prescriptions

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 7.1 | `POST` | `/invoices` | `{ patient_id, issue_date, line_items:[{description, quantity, unit_price_dzd, treatment_record_id}] }` | `201` (code `INV-YYYYMM-NNNN`, status unpaid) | Billing |
| 7.2 | `GET` | `/invoices` | — | `200 [ids]` | Billing page |
| 7.3 | `GET` | `/invoices/:id` | — | `200 { invoice, line_items, payments }` | Invoice detail |
| 7.4 | `POST` | `/payments` | `{ invoice_id, amount_dzd, payment_method_key, payment_date }` | `201` (recompute `paid_amount_dzd` via DB trigger) | Payment add |
| 7.5 | `GET` | `/payments` | — | `200 [ids]` | Billing |
| 7.6 | `GET` | `/payments/batch?ids=…` | — | `200 [objects]` | Billing |
| 7.7 | `GET` | `/invoices/batch?ids=…` | — | `200 [objects]` (incl `balance_dzd`) | Billing |
| 7.8 | `PATCH` | `/invoices/:id/payment` | `{ paid_amount_dzd }` | `200` (overpay → 400) | Billing |
| 7.9 | `PATCH` | `/invoices/:id/status` | `{ payment_status_key }` | `200` | Billing |
| 7.10 | `PATCH` | `/invoices/:id` | `{ notes, discount_dzd }` | `200` (header fields) | Billing edit |
| 7.11 | `PATCH` | `/payments/:id` | `{ amount_dzd, notes }` | `200` | Payment edit |
| 7.12 | `POST` | `/prescriptions` | `{ patient_id, medication_name, dosage, frequency, duration, notes }` | `201` (code `RX-YYYYMM-NNNN`) | Prescription add |
| 7.13 | `GET` | `/prescriptions` | — | `200 [ids]` | Prescription list |
| 7.14 | `GET` | `/prescriptions/batch?ids=…` | — | `200 [objects]` | Prescription |
| 7.15 | `PATCH` | `/prescriptions/:id` | `{ status_key }` | `200` | Prescription workflow |
| 7.16 | `GET` | `/invoices/search?search=…` | — | `200 [ids]` | Global search |
| 7.17 | `GET` | `/payments/search?search=…` | — | `200 [ids]` | Global search |
| 7.18 | `GET` | `/prescriptions/search?search=…` | — | `200 [ids]` | Global search |
| 7.19 | `DELETE` | `/payments/:id` | — | `204` (recompute paid_amount) | Payment delete |
| 7.20 | `DELETE` | `/invoices/:id` | — | `204` | Invoice delete |
| 7.21 | `DELETE` | `/prescriptions/:id` | — | `204` | Prescription delete |

---

## Phase 8 — Expenses + Purchase orders

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 8.1 | `POST` | `/expenses` | `{ category_key, description, amount_dzd, expense_date, payment_method_key, status_key }` | `201` (code `EXP-YYYYMM-NNNN`) | Expense add |
| 8.2 | `GET` | `/expenses` | — | `200 [ids]` | Expenses page |
| 8.3 | `GET` | `/expenses/batch?ids=…` | — | `200 [objects]` | Expenses |
| 8.4 | `PATCH` | `/expenses/:id/status` | `{ status_key }` (→ approved) | `200` | Expenses menu |
| 8.5 | `PATCH` | `/expenses/:id` | `{ amount_dzd, notes }` | `200` | Expense edit |
| 8.6 | `GET` | `/expenses/search?search=…` | — | `200 [ids]` | Global search |
| 8.7 | `POST` | `/purchase-orders` | `{ supplier_id, items:[{inventory_item_id, quantity_ordered, unit_cost_dzd}] }` | `201` (code `PO-YYYYMM-NNNN`) | PO add |
| 8.8 | `GET` | `/purchase-orders` | — | `200 [ids]` | PO list |
| 8.9 | `GET` | `/purchase-orders/:id` | — | `200 { order, items }` | PO detail |
| 8.10 | `PATCH` | `/purchase-orders/:id/status` | `{ status_key }` (→ approved) | `200` | PO status |
| 8.11 | `PATCH` | `/purchase-orders/:id/receive` | `{ items:[{item_id, quantity_received}] }` | `200` (stock movement `purchase`) | PO receive |
| 8.12 | `PATCH` | `/purchase-orders/:id` | `{ shipping_dzd, notes }` | `200` | PO edit |
| 8.13 | `GET` | `/purchase-orders/search?search=…` | — | `200 [ids]` | Global search |
| 8.14 | `DELETE` | `/purchase-orders/:id` | — | `204` (draft only) | PO delete |
| 8.15 | `DELETE` | `/expenses/:id` | — | `204` | Expense delete |

---

## Phase 9 — X-rays + Media

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 9.1 | `POST` | `/xrays/upload` | multipart `file` + `patient_id`, `description`, optional `tooth_number` | `201` (attaches media, Cloudinary) | X-ray upload |
| 9.2 | `GET` | `/xrays?patient_id=` | — | `200 [ids]` | X-ray gallery |
| 9.3 | `GET` | `/xrays/batch?ids=…` | — | `200 [objects]` | X-ray gallery |
| 9.4 | `GET` | `/xrays/:id` | — | `200` (xray + media) | X-ray detail |
| 9.5 | `PATCH` | `/xrays/:id` | `{ description, tooth_number }` | `200` | X-ray edit |
| 9.6 | `DELETE` | `/xrays/:id` | — | `204` | X-ray delete |
| 9.7 | `GET` | `/media` | — | `200 [ids]` | (Media list) |
| 9.8 | `POST` | `/media/upload` | multipart `file` | `201` | (Media; client unused) |
| 9.9 | `GET` | `/media/:id` | — | `200` | (Media detail) |
| 9.10 | `PATCH` | `/media/:id` | `{ description, category }` | `200` | (Media edit) |
| 9.11 | `DELETE` | `/media/:id` | — | `204` | (Media delete) |

---

## Phase 10 — Dashboard + Reports + Audit + Notifications (read-side)

| # | Method | Path | Body / query | Expected | Screen |
|---|--------|------|--------------|----------|--------|
| 10.1 | `GET` | `/dashboard/appointments/today` | — | `200` | Dashboard "today" |
| 10.2 | `GET` | `/dashboard/patients/raw` | `?start_date=&end_date=` | `200 { patients }` | Dashboard stats |
| 10.3 | `GET` | `/dashboard/appointments/raw` | `?start_date=&end_date=` | `200 { appointments }` | Dashboard stats |
| 10.4 | `GET` | `/dashboard/treatments/raw` | `?start_date=&end_date=` | `200 { treatments }` | Dashboard stats |
| 10.5 | `GET` | `/dashboard/payments/raw` | `?start_date=&end_date=` | `200 { payments }` | Dashboard stats |
| 10.6 | `GET` | `/dashboard/recent-activity` | — (admin) | `200` | Dashboard activity |
| 10.7 | `GET` | `/reports/revenue/monthly?months=12` | — (admin) | `200 { data, summary }` | Reports |
| 10.8 | `GET` | `/reports/revenue/by-method?months=12` | — (admin) | `200` | Reports |
| 10.9 | `GET` | `/reports/procedures/frequency?months=12` | — (admin) | `200` | Reports |
| 10.10 | `GET` | `/reports/patients/new?months=12` | — (admin) | `200` | Reports |
| 10.11 | `GET` | `/reports/appointments/stats?months=12` | — (admin) | `200` | Reports |
| 10.12 | `GET` | `/reports/plans/summary` | — (admin) | `200` | Reports |
| 10.13 | `GET` | `/reports/dentist/stats` | `?start_date=&end_date=` | `200` | Reports |
| 10.14 | `GET` | `/reports/revenue/export` | `?start_date=&end_date=` | `200` CSV | Reports export |
| 10.15 | `GET` | `/audit-logs` | `?entity_type=&action=` | `200` | Audit viewer (admin) |
| 10.16 | `GET` | `/audit-logs/batch?ids=…` | — | `200` | Audit viewer |
| 10.17 | `GET` | `/audit-logs/:id` | — | `200` | Audit viewer |
| 10.18 | `GET` | `/notifications?limit=50` | — | `200 [objects]` | App-bar bell |
| 10.19 | `GET` | `/notifications/unread-count` | — | `200 { count }` | App-bar badge |
| 10.20 | `PUT` | `/notifications/:id/read` | — | `200 { success:true }` | Bell click |
| 10.21 | `PUT` | `/notifications/read-all` | — | `200 { success:true }` | Bell "mark all" |

---

## Phase 11 — Public booking portal (unauthenticated, browser-side)

These are called by the **website** (`public/book.js`), not the desktop client. Verified
against the same tenant's `subdomain` slug from Phase 0.

| # | Method | Path | Body / query | Expected | Surface |
|---|--------|------|--------------|----------|---------|
| 11.1 | `GET` | `/public/:subdomain/dentists` | — | `200 [{ id, full_name }]` | Booking portal |
| 11.2 | `GET` | `/public/:subdomain/services` | — | `200` (global + clinic categories) | Booking portal |
| 11.3 | `GET` | `/public/:subdomain/slots?date=YYYY-MM-DD&dentist_id=` | — | `200 { date, availability }` | Booking portal |
| 11.4 | `POST` | `/public/:subdomain/bookings` | `{ full_name, phone(+213…), dentist_id, appointment_date, notes }` | `201` (guest patient + scheduled appt) | Booking portal |

> Requires `working_hours` for the dentist; to exercise 11.3/11.4, seed a dentist + working
> hours (see `scripts/seed-demo-clinic.js`) or create them via the admin flow and DB.

---

## Phase 12 — Platform operator console (`auth.role.platform_admin`)

Only a platform operator (under the reserved `sera-platform` tenant, provisioned via
`scripts/create-platform-admin.js`) can call these. They are cross-tenant and admin-gated.

| # | Method | Path | Body / query | Expected | Surface |
|---|--------|------|--------------|----------|---------|
| 12.1 | `POST` | `/auth/login` | operator creds | `200` (role has `auth.role.platform_admin`) | platform.js login |
| 12.2 | `GET` | `/platform/stats` | — | `200` platform totals | platform.html |
| 12.3 | `GET` | `/platform/tenants?search=` | — (page/limit) | `200` list w/ per-tenant counts | platform.html |
| 12.4 | `GET` | `/platform/tenants/:id` | — | `200 { tenant, users }` | platform.html |
| 12.5 | `PATCH` | `/platform/tenants/:id` | `{ subscription_status, is_active, … }` | `200` | platform.html |
| 12.6 | `GET` | `/platform/revenue` | — | `200` | platform.html |
| 12.7 | `GET` | `/platform/plans` | — | `200` | platform.html |
| 12.8 | `POST` | `/platform/plans` | plan fields | `201` | platform.html |
| 12.9 | `GET` | `/platform/analytics` | — | `200` | platform.html |
| 12.10 | `GET` | `/platform/tenants/export` | — | `200` CSV | platform.html |
| 12.11 | `GET` | `/platform/audit` | — | `200` | platform.html |
| 12.12 | `POST` | `/platform/impersonate/:tenantId` | — | `200 { token, tenant, user }` | platform.html |
| 12.13 | `GET` | `/platform/announcements` | — | `200` | platform.html |

---

## Verification strategy

`e2e-flow.js` runs Phases 0–10 (and 12 if `PLATFORM_EMAIL`/`PLATFORM_PASSWORD` are set) in
order against a live backend, asserting the status code and key invariants (e.g. payment
syncs `paid_amount_dzd`, received PO creates a stock movement) per step. Each step is a
PASS/FAIL; any failure exits non-zero (CI-usable), matching the `verify-*` script contract.
Run it against a **throwaway** tenant/signup so real data is never touched.
