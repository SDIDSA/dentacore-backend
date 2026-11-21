const rateLimit = require('express-rate-limit');

const parseEnvInt = (key, fallback) => {
  const val = process.env[key];
  if (val === undefined || val === '') return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isSafeMethod = (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

const isUnthrottled = (req) => {
  if (process.env.NODE_ENV === 'test') return true;
  if (req.method === 'OPTIONS') return true;

  const path = req.path || '';
  const url = req.originalUrl || '';

  // Health checks
  if (path === '/health' || url === '/health' || url.startsWith('/health?') || path.endsWith('/health')) {
    return true;
  }

  // Static assets
  if (/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|html|map)$/i.test(path)) {
    return true;
  }

  return false;
};

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isUnthrottled(req),
};

const apiLimiter = rateLimit({
  ...defaults,
  windowMs: parseEnvInt('RATE_LIMIT_WINDOW_MS', 60 * 1000),
  limit: () => parseEnvInt('RATE_LIMIT_MAX', 600),
  max: () => parseEnvInt('RATE_LIMIT_MAX', 600),
  message: { error: 'error.too_many_requests' },
});

const mutationLimiter = rateLimit({
  ...defaults,
  windowMs: parseEnvInt('RATE_LIMIT_WINDOW_MS', 60 * 1000),
  limit: () => parseEnvInt('MUTATION_LIMIT_MAX', 180),
  max: () => parseEnvInt('MUTATION_LIMIT_MAX', 180),
  skip: (req) => isUnthrottled(req) || isSafeMethod(req),
  message: { error: 'error.too_many_requests' },
});

const strictMutationLimiter = rateLimit({
  ...defaults,
  windowMs: parseEnvInt('RATE_LIMIT_WINDOW_MS', 60 * 1000),
  limit: () => parseEnvInt('STRICT_MUTATION_LIMIT_MAX', 30),
  max: () => parseEnvInt('STRICT_MUTATION_LIMIT_MAX', 30),
  skip: (req) => isUnthrottled(req) || isSafeMethod(req),
  message: { error: 'error.too_many_requests' },
});

module.exports = {
  apiLimiter,
  mutationLimiter,
  strictMutationLimiter,
  isSafeMethod,
  isUnthrottled,
  parseEnvInt,
};

