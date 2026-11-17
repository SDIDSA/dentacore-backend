# Services

## Purpose
Business logic layer — houses notification service and scheduled tasks. Extracted from route handlers for testability and reuse.

## Ownership
- `notificationService.js` — Notification creation, delivery, polling, and reminder scheduling

## Local Contracts
- Services are stateless singletons; state managed via database
- Services receive `db` (Kysely instance) and optionally `io` (Socket.IO) on init
- The appointment reminder scheduler runs in `server.js` via `setInterval` (default 15 min); polls all tenants
- Reminders are **really delivered**: patients with an email get one via SMTP (`nodemailer`, `SMTP_*` in `.env`); one attempt per appointment; the `notifications` row records `status` `sent` (with `sent_at`) or `failed` — never `sent` unless delivered. There is **no SMS provider**: phone-only patients get a `failed` sms row
- **Generated notification copy is French** — the client renders `title`/`message` raw (`AppBarNotifications` uses unkeyed text), so backend-composed strings are the user-facing copy. Reminder and low-stock notifications are written in French (fr-DZ phrasing); new notification types must stay single-language French

## Work Guidance

## Verification

## Child DOX Index
(empty)
