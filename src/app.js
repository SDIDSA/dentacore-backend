const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const auditLogger = require('./middleware/auditLogger');
const conflictResolution = require('./middleware/conflictResolution');
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

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { apiLimiter, mutationLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : (process.env.NODE_ENV === 'production'
    ? (() => { console.warn('CORS_ORIGIN not set in production — all cross-origin requests will be blocked. Set CORS_ORIGIN to your frontend URL.'); return []; })()
    : ['http://localhost:3000', 'http://localhost:5173']);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
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

// API v1 routes
app.use('/api/v1/auth', authRoutes);
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

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

const path = require('path');
const fs = require('fs');
const updatesDir = path.join(__dirname, '..', 'updates');
app.use('/api/v1/updates', (req, res, next) => {
  if (req.path === '/version') {
    const ver = JSON.parse(fs.readFileSync(path.join(updatesDir, 'version.json'), 'utf8'));
    res.json(ver);
  } else if (req.path.startsWith('/download/')) {
    const filename = req.path.slice('/download/'.length);
    res.download(path.join(updatesDir, filename), filename);
  } else {
    next();
  }
});

app.use(express.static('public'));

app.use(errorHandler);

module.exports = app;
