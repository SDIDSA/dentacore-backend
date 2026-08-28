// Lightweight request logger — writes every API request to api_usage_logs
// for the platform health dashboard. Non-blocking: failures are swallowed
// so they never break the request pipeline.
const db = require('../config/database');

const SKIP_PATHS = ['/health', '/api/version', '/favicon.ico'];

function apiUsageLogger(req, res, next) {
  if (SKIP_PATHS.includes(req.path)) return next();

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const tenantId = req.tenantId || req.user?.tenant_id || null;
    const ip = req.ip || req.connection?.remoteAddress || null;

    db.insertInto('api_usage_logs')
      .values({
        tenant_id: tenantId,
        method: req.method,
        path: req.path.slice(0, 500),
        status_code: res.statusCode,
        duration_ms: durationMs,
        ip_address: ip,
      })
      .execute()
      .catch(() => {});
  });

  next();
}

module.exports = apiUsageLogger;
