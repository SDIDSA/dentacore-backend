const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const auditLogger = require('./middleware/auditLogger');
const logger = require('./config/logger');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const inventoryRoutes = require('./routes/inventory');
const treatmentRoutes = require('./routes/treatments');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');
const expenseRoutes = require('./routes/expenses');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const mediaRoutes = require('./routes/media');
const xrayRoutes = require('./routes/xrays');

const auditLogsRoutes = require('./routes/auditLogs');
const treatmentPlanRoutes = require('./routes/treatmentPlans');
const prescriptionRoutes = require('./routes/prescriptions');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const odontogramRoutes = require('./routes/odontogram');
const publicBookingRoutes = require('./routes/publicBookings');
const signupRoutes = require('./routes/signup');
const platformRoutes = require('./routes/platform');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { apiLimiter, mutationLimiter } = require('./middleware/rateLimiter');
const apiUsageLogger = require('./middleware/apiUsageLogger');

const app = express();

// Behind nginx (single reverse-proxy hop) in production; lets express-rate-limit
// and req.ip see real client IPs from X-Forwarded-For instead of 127.0.0.1.
app.set('trust proxy', 1);

// CSP: helmet defaults with one adjustment (production only; dev disables CSP):
// `upgrade-insecure-requests` is dropped when serving direct HTTP-only on port 80
// (no proxy/TLS) — otherwise the browser rewrites every http:// asset to https://
// and breaks the page. helmet semantics: `null` removes a directive (`[]` would
// still emit it bare).
const onPort80 = String(process.env.PORT || '').trim().split(',').includes('80');
const cspDirectives = onPort80 ? { 'upgrade-insecure-requests': null } : {};

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : { directives: cspDirectives },
}));
function defaultAllowedOrigins() {
  if (process.env.NODE_ENV === 'production') {
    // Production still serves the public site (signup/booking/marketing) from
    // this same backend, so same-host origins are allowed automatically by the
    // middleware below; CORS_ORIGIN is only needed for *other* frontend domains.
    return [];
  }
  return ['http://localhost:4000', 'http://localhost:5173', 'http://localhost']; // localhost:80 (hosted HTTP-only test)
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : defaultAllowedOrigins();

// Custom CORS: the public site is served by this same backend, so a request
// whose Origin host matches the request Host is same-origin and always allowed
// (no need to hardcode the deployment domain). Any explicitly listed origin in
// CORS_ORIGIN (other frontend domains) is also allowed. Preflight OPTIONS are
// answered directly. This replaces the `cors` package because its origin
// callback cannot see req and therefore can't match the server's own host.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;

  function allow(o) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // No Origin header => same-origin browser fetch; nothing to do.
  if (!origin) return next();

  // Explicit allow-list (CORS_ORIGIN), incl. wildcard.
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    allow(origin);
    return next();
  }

  // Same-host: origin's host matches this server's Host (covers http/https and
  // any port the deployment uses for the public site).
  let sameHost = false;
  try { sameHost = new URL(origin).host === host; } catch (_) { /* ignore */ }
  if (sameHost) {
    allow(origin);
    return next();
  }

  // Rejected cross-origin: do not emit CORS headers so the browser blocks it.
  logger.error('CORS rejected request', { origin, host, allowedOrigins });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID().slice(0, 8);
  res.setHeader('x-request-id', req.requestId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
    });
  });
  next();
});

app.use(auditLogger.middleware());
app.use(apiUsageLogger);

const { getIO } = require('./socket');
app.use((req, res, next) => {
  try { req.io = getIO(); } catch { req.io = null; }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (req, res) => {
  res.json({ version: 'v1', current: true });
});

// API v1 rate limiting — mounted BEFORE the routers so matched requests are limited
app.use('/api/v1', apiLimiter);
app.use('/api/v1/patients', mutationLimiter);
app.use('/api/v1/appointments', mutationLimiter);
app.use('/api/v1/inventory', mutationLimiter);
app.use('/api/v1/treatments', mutationLimiter);
app.use('/api/v1/payments', mutationLimiter);
app.use('/api/v1/invoices', mutationLimiter);
app.use('/api/v1/expenses', mutationLimiter);
app.use('/api/v1/purchase-orders', mutationLimiter);
app.use('/api/v1/media', mutationLimiter);
app.use('/api/v1/xrays', mutationLimiter);
app.use('/api/v1/treatment-plans', mutationLimiter);
app.use('/api/v1/prescriptions', mutationLimiter);
app.use('/api/v1/notifications', mutationLimiter);
app.use('/api/v1/odontogram', mutationLimiter);
app.use('/api/v1/users', mutationLimiter);

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/signup', signupRoutes);
app.use('/api/v1/platform', mutationLimiter, platformRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/treatments', treatmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/xrays', xrayRoutes);

app.use('/api/v1/audit-logs', auditLogsRoutes);
app.use('/api/v1/treatment-plans', treatmentPlanRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/odontogram', odontogramRoutes);

// Public booking portal — unauthenticated by design; clinic resolved from the
// subdomain slug in the path, strict per-IP limiter inside the router.
app.use('/api/v1/public', publicBookingRoutes);

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Clean URLs: serve the public pages without the .html suffix and redirect
// any legacy /foo.html request to its extensionless form (e.g. /book).
const PUBLIC_PAGES = {
  '/book': 'book.html',
  '/signup': 'signup.html',
  '/platform': 'platform.html'
};
app.get(Object.keys(PUBLIC_PAGES), (req, res) => {
  res.sendFile(require('node:path').resolve('public', PUBLIC_PAGES[req.path]));
});
// Booking portal also accepts the pretty /book/<slug> form and rewrites it to
// the query param the page reads (/book?clinic=<slug>), so either link works.
app.get('/book/:clinic', (req, res) => {
  res.redirect(301, '/book?clinic=' + encodeURIComponent(req.params.clinic));
});
app.use((req, res, next) => {
  const m = /^\/(book|signup|platform)\.html(\?.*)?$/.exec(req.path);
  if (m) {
    return res.redirect(301, '/' + m[1] + (m[2] || ''));
  }
  next();
});

app.use(express.static('public'));

app.use(errorHandler);

module.exports = app;
