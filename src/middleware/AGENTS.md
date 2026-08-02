# Middleware

## Purpose
Express middleware pipeline — authentication, authorization, audit logging, rate limiting, error handling, and response formatting.

## Ownership
- `auth.js` — JWT verification, role-based access control (RBAC)
- `auditLogger.js` — Request audit logging (capped queue at 1000 entries)
- `rateLimiter.js` — Configurable rate limiting via express-rate-limit
- `errorHandler.js` — Global error handler (hides stack traces in production)
- `responseFormatter.js` — Consistent `{ data, meta }` response envelope
- `conflictResolution.js` — Conflict resolution for offline sync

## Local Contracts
- Auth middleware must run before all protected routes
- `responseFormatter` wraps all successful responses; `errorHandler` wraps all errors
- Rate limiter configurable per-route via factory function
- Audit logger skips non-mutation methods (GET/HEAD/OPTIONS)

## Work Guidance

## Verification

## Child DOX Index
(empty)
