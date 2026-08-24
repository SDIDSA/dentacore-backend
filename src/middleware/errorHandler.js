const log = require('../utils/logger');

const webhookAlert = (err, status, req) => {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url || process.env.NODE_ENV !== 'production' || status < 500) return;
  try {
    const payload = JSON.stringify({
      content: `Sera 500: ${err.message}`,
      status,
      method: req.method,
      path: req.originalUrl,
    });
    const { request } = url.startsWith('https') ? require('node:https') : require('node:http');
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (url.startsWith('https') ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 5000,
    };
    const hookReq = request(reqOpts, () => {});
    hookReq.on('error', () => {});
    hookReq.write(payload);
    hookReq.end();
  } catch {
    // alerting must never break error handling
  }
};

const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    log.error('Unhandled error', { message: err.message, stack: err.stack });
  } else {
    log.error('Unhandled error', { message: err.message });
  }

  if (err.name === 'ValidationError') {
    err.statusCode = 400;
    return res.status(400).json({
      error: 'validation.error',
      details: err.details,
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'error.duplicate_entry' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'error.foreign_key_violation' });
  }

  const status = err.statusCode || err.status || 500;
  if (status >= 500) webhookAlert(err, status, req);
  const message = !isDev && status >= 500 ? 'error.internal_server' : err.message || 'error.internal_server';
  res.status(status).json({ error: message });
};

module.exports = errorHandler;

