# Middleware

## Purpose
Express middleware pipeline — authentication, authorization, audit logging, rate limiting, error handling, and response formatting.

## Ownership
- `auth.js` — JWT verification, role-based access control (RBAC)
- `auditLogger.js` — Request audit logging (capped queue at 1000 entries)
- `rateLimiter.js` — Configurable rate limiting via express-rate-limit (`apiLimiter` default 600/min via `RATE_LIMIT_MAX`, `mutationLimiter` default 180/min via `MUTATION_LIMIT_MAX`, `strictMutationLimiter` default 30/min via `STRICT_MUTATION_LIMIT_MAX` — mounted on `/:clinic` in the public booking router)
- `tenantBySlug.js` — Public-route tenant resolution: maps the `:clinic` subdomain slug to `req.tenantId` + `req.tenant`; unknown/malformed slugs all return the same generic 404 (`public.clinic_not_found`) so the clinic namespace can't be probed. Must be attached as `router.use('/:clinic', …)` — a bare `router.use(fn)` matches everything but captures no params
- `errorHandler.js` — Global error handler (hides stack traces in production)
- `responseFormatter.js` — `{ data, meta }` envelope helper; **not mounted** in `src/app.js` (routes return bare responses today)
- `conflictResolution.js` — Stale-write guard for offline sync (`res.conflictCheck(record)` → 409 `conflict.detected`)

## Local Contracts
- Auth middleware must run before all protected routes
- `responseFormatter` is not part of the active pipeline; `errorHandler` wraps all errors — in production, statuses ≥ 500 return the generic `error.internal_server` key, never the raw `err.message` (dev keeps real messages), and POST a non-blocking alert to `ERROR_WEBHOOK_URL` when set
- Rate limiters configurable via env vars (`RATE_LIMIT_MAX`, `MUTATION_LIMIT_MAX`, `STRICT_MUTATION_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`); `mutationLimiter` and `strictMutationLimiter` skip safe methods (GET/HEAD/OPTIONS); OPTIONS preflights, health checks (`/health`), and static assets are completely unthrottled; all limiters bypassed when `NODE_ENV=test`
- Audit logger skips non-mutation methods (GET/HEAD/OPTIONS)
- **Conflict check never compares a raw client clock with server time (durable)**: client clocks drift (a PC 1 min slow had every calendar drag rejected). A live edit (only the `X-Client-Timestamp` send-time header) is never treated as stale; only an edit carrying its own edit time (`body.clientTimestamp`, offline replay) is checked, after shifting it by the sender's offset `serverNow - X-Client-Timestamp`. Covered by `__tests__/conflictResolution.test.js`
- Socket.IO patient rooms are tenant-scoped (`patient:<tenantId>:<patientId>`; `emitToPatient(tenantId, patientId, …)`). The legacy `/api/v1/updates/*` local-file channel was removed 2026-08-25 — updates ship via GitHub Releases (`SDIDSA/packages`) consumed by the bootstrapper

## Work Guidance

## Verification

## Child DOX Index
(empty)
