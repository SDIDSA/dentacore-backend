# Utils

## Purpose
Shared utility modules used across routes and services.

## Ownership
- `csv.js` — CSV generation and parsing utilities (used for patient import/export)
- `logger.js` — Structured logging wrapper with levels
- `paginate.js` — Kysely-based pagination helper (page/limit/sort/order)
- `upload.js` — Multer-based file upload configuration

## Local Contracts
- `paginate.js` is the standard pagination interface for all list endpoints
- `csv.js` handles both export (rows → CSV string) and import (CSV → rows)
- `upload.js` configured for Cloudinary-compatible file handling

## Work Guidance

## Verification

## Child DOX Index
(empty)
