const rateLimit = require('express-rate-limit');

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
};

const apiLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'error.too_many_requests' },
});

const mutationLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'error.too_many_requests' },
});

const strictMutationLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'error.too_many_requests' },
});

module.exports = { apiLimiter, mutationLimiter, strictMutationLimiter };
