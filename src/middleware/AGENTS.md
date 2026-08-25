# Middleware

## Purpose
Express middleware pipeline — authentication, authorization, audit logging, rate limiting, error handling, and response formatting.

## Ownership
- `auth.js` — JWT verification, role-based access control (RBAC)
- `auditLogger.js` — Request audit logging (capped queue at 1000 entries)
- `rateLimiter.js` — Configurable rate limiting via express-rate-limit (`apiLimiter`, `mutationLimiter`, `strictMutationLimiter` 10/min — the public booking router mounts it router-wide)
- `tenantBySlug.js` — Public-route tenant resolution: maps the `:clinic` subdomain slug to `req.tenantId` + `req.tenant`; unknown/malformed slugs all return the same generic 404 (`public.clinic_not_found`) so the clinic namespace can't be probed. Must be attached as `router.use('/:clinic', …)` — a bare `router.use(fn)` matches everything but captures no params
- `errorHandler.js` — Global error handler (hides stack traces in production)
- `responseFormatter.js` — `{ data, meta }` envelope helper; **not mounted** in `src/app.js` (routes return bare responses today)
- `conflictResolution.js` — Conflict resolution for offline sync

## Local Contracts
- Auth middleware must run before all protected routes
- `responseFormatter` is not part of the active pipeline; `errorHandler` wraps all errors — in production, statuses ≥ 500 return the generic `error.internal_server` key, never the raw `err.message` (dev keeps real messages), and POST a non-blocking alert to `ERROR_WEBHOOK_URL` when set
- Rate limiter configurable per-route via factory function; `mutationLimiter` skips safe methods (GET/HEAD/OPTIONS); all limiters bypassed when `NODE_ENV=test`
- Audit logger skips non-mutation methods (GET/HEAD/OPTIONS)
- Socket.IO patient rooms are tenant-scoped (`patient:<tenantId>:<patientId>`; `emitToPatient(tenantId, patientId, …)`), and the `/api/v1/updates/download/:filename` endpoint in `app.js` serves only allowlisted filenames resolved strictly inside `updates/`

## Work Guidance

## Verification

## Child DOX Index
(empty)
