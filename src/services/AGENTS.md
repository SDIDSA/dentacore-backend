# Services

## Purpose
Business logic layer — houses notification service and scheduled tasks. Extracted from route handlers for testability and reuse.

## Ownership
- `notificationService.js` — Notification creation, delivery, polling, and reminder scheduling

## Local Contracts
- Services are stateless singletons; state managed via database
- Services receive `db` (Kysely instance) and optionally `io` (Socket.IO) on init
- The appointment reminder scheduler runs in `server.js` via `setInterval` (default 15 min); polls all tenants

## Work Guidance

## Verification

## Child DOX Index
(empty)
