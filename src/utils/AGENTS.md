# Utils

## Purpose
Shared utility modules used across routes and services.

## Ownership
- `csv.js` — CSV generation and parsing utilities (used for patient import/export)
- `clinicHours.js` — Clinic opening hours SSOT: `tenants.settings.working_hours` (`{slot_minutes, days:[{day_of_week 0=Sun..6=Sat, enabled, start, end}]}`; default every day but Friday 08:00–17:00, matching the desktop client). Per-dentist `working_hours` rows are **derived**: `applyClinicHours` rewrites all of a tenant's rows for every active dentist; `syncDentistHours` adds/removes one user's rows on role/status change. GET falls back to the existing rows (seeded tenants), then the default
- `availability.js` — Public-booking slot engine: intersects `working_hours` windows with booked active appointments (Africa/Algiers wall clock, fixed UTC+01 — no DST) and returns per-dentist free `HH:MM` slots; also exposes `algiersNow()`/`dayOfWeek()` helpers
- `logger.js` — Structured logging wrapper with levels
- `fileSink.js` — Size-rotated file log sink (`logs/backend.log`, 5 MB × 5 files; `LOG_DIR`/`LOG_MAX_SIZE_BYTES`/`LOG_MAX_FILES` override) — best-effort, never crashes the process
- `paginate.js` — Kysely-based pagination helper (page/limit/sort/order)
- `upload.js` — Multer-based file upload configuration

## Local Contracts
- `paginate.js` is the standard pagination interface for all list endpoints; the `{data, total, limit, offset}` envelope is returned ONLY when `?limit=` is explicitly present — param-less requests get bare id arrays (the JavaFX client relies on this)
- `csv.js` handles both export (rows → CSV string) and import (CSV → rows)
- `upload.js` configured for Cloudinary-compatible file handling

## Work Guidance

## Verification

## Child DOX Index
(empty)


