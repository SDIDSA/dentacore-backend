const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const app = require('../app');
const {
  apiLimiter,
  mutationLimiter,
  strictMutationLimiter,
  isSafeMethod,
  isUnthrottled,
  parseEnvInt,
} = require('../middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  describe('parseEnvInt helper', () => {
    it('returns fallback when env var is undefined or empty', () => {
      delete process.env.TEST_RL_VAR;
      expect(parseEnvInt('TEST_RL_VAR', 600)).toBe(600);
      process.env.TEST_RL_VAR = '';
      expect(parseEnvInt('TEST_RL_VAR', 600)).toBe(600);
    });

    it('parses valid integer strings', () => {
      process.env.TEST_RL_VAR = '1200';
      expect(parseEnvInt('TEST_RL_VAR', 600)).toBe(1200);
    });

    it('returns fallback for invalid integers', () => {
      process.env.TEST_RL_VAR = 'invalid';
      expect(parseEnvInt('TEST_RL_VAR', 600)).toBe(600);
    });
  });

  describe('isSafeMethod helper', () => {
    it('identifies GET, HEAD, OPTIONS as safe methods', () => {
      expect(isSafeMethod({ method: 'GET' })).toBe(true);
      expect(isSafeMethod({ method: 'HEAD' })).toBe(true);
      expect(isSafeMethod({ method: 'OPTIONS' })).toBe(true);
    });

    it('identifies mutation methods as unsafe', () => {
      expect(isSafeMethod({ method: 'POST' })).toBe(false);
      expect(isSafeMethod({ method: 'PUT' })).toBe(false);
      expect(isSafeMethod({ method: 'PATCH' })).toBe(false);
      expect(isSafeMethod({ method: 'DELETE' })).toBe(false);
    });
  });

  describe('isUnthrottled helper', () => {
    it('skips when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      expect(isUnthrottled({ method: 'POST', path: '/api/v1/patients' })).toBe(true);
    });

    it('skips OPTIONS requests even when not in test env', () => {
      process.env.NODE_ENV = 'production';
      expect(isUnthrottled({ method: 'OPTIONS', path: '/api/v1/patients' })).toBe(true);
    });

    it('skips health check endpoints', () => {
      process.env.NODE_ENV = 'production';
      expect(isUnthrottled({ method: 'GET', path: '/health', originalUrl: '/health' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/api/v1/health', originalUrl: '/health' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/health', originalUrl: '/health?full=1' })).toBe(true);
    });

    it('skips static asset file extensions', () => {
      process.env.NODE_ENV = 'production';
      expect(isUnthrottled({ method: 'GET', path: '/style.css' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/bundle.js' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/favicon.ico' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/logo.svg' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/font.woff2' })).toBe(true);
      expect(isUnthrottled({ method: 'GET', path: '/image.png' })).toBe(true);
    });

    it('does not skip normal API routes in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isUnthrottled({ method: 'GET', path: '/api/v1/patients' })).toBe(false);
      expect(isUnthrottled({ method: 'POST', path: '/api/v1/patients' })).toBe(false);
    });
  });

  describe('Dynamic production threshold limits', () => {
    it('defaults to 600 req/min for apiLimiter, 180 for mutationLimiter, 30 for strictMutationLimiter', () => {
      delete process.env.RATE_LIMIT_MAX;
      delete process.env.MUTATION_LIMIT_MAX;
      delete process.env.STRICT_MUTATION_LIMIT_MAX;

      expect(parseEnvInt('RATE_LIMIT_MAX', 600)).toBe(600);
      expect(parseEnvInt('MUTATION_LIMIT_MAX', 180)).toBe(180);
      expect(parseEnvInt('STRICT_MUTATION_LIMIT_MAX', 30)).toBe(30);
    });

    it('respects env var overrides dynamically', () => {
      process.env.RATE_LIMIT_MAX = '1000';
      process.env.MUTATION_LIMIT_MAX = '300';
      process.env.STRICT_MUTATION_LIMIT_MAX = '50';

      expect(parseEnvInt('RATE_LIMIT_MAX', 600)).toBe(1000);
      expect(parseEnvInt('MUTATION_LIMIT_MAX', 180)).toBe(300);
      expect(parseEnvInt('STRICT_MUTATION_LIMIT_MAX', 30)).toBe(50);
    });
  });

  describe('Live rate limiting behavior in simulated production app', () => {
    let testApp;

    beforeEach(() => {
      // Use an isolated Express app simulating production
      testApp = express();
      process.env.NODE_ENV = 'production';

      // Test limiter with small max to verify 429 and headers
      const testLimiter = rateLimit({
        standardHeaders: true,
        legacyHeaders: false,
        windowMs: 60 * 1000,
        limit: () => parseEnvInt('TEST_LIMIT', 3),
        max: () => parseEnvInt('TEST_LIMIT', 3),
        skip: (req) => isUnthrottled(req),
        message: { error: 'error.too_many_requests' },
      });

      const testMutationLimiter = rateLimit({
        standardHeaders: true,
        legacyHeaders: false,
        windowMs: 60 * 1000,
        limit: () => parseEnvInt('TEST_MUTATION_LIMIT', 2),
        max: () => parseEnvInt('TEST_MUTATION_LIMIT', 2),
        skip: (req) => isUnthrottled(req) || isSafeMethod(req),
        message: { error: 'error.too_many_requests' },
      });

      testApp.use('/api/data', testLimiter);
      testApp.use('/api/mutate', testMutationLimiter);

      testApp.get('/api/data', (req, res) => res.json({ ok: true }));
      testApp.options('/api/data', (req, res) => res.sendStatus(204));
      testApp.get('/health', (req, res) => res.json({ status: 'ok' }));
      testApp.get('/assets/style.css', (req, res) => res.send('body {}'));

      testApp.get('/api/mutate', (req, res) => res.json({ method: 'GET' }));
      testApp.post('/api/mutate', (req, res) => res.json({ method: 'POST' }));
    });

    it('emits standard RateLimit-* headers', async () => {
      const res = await request(testApp).get('/api/data');
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
      expect(res.headers).toHaveProperty('ratelimit-reset');
      expect(res.headers['ratelimit-limit']).toBe('3');
      expect(res.headers['ratelimit-remaining']).toBe('2');
    });

    it('blocks with 429 when limit is exceeded', async () => {
      await request(testApp).get('/api/data'); // 1
      await request(testApp).get('/api/data'); // 2
      await request(testApp).get('/api/data'); // 3
      const blocked = await request(testApp).get('/api/data'); // 4
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'error.too_many_requests' });
    });

    it('leaves OPTIONS requests completely unthrottled', async () => {
      // Exceed the limit first
      await request(testApp).get('/api/data');
      await request(testApp).get('/api/data');
      await request(testApp).get('/api/data');
      const getBlocked = await request(testApp).get('/api/data');
      expect(getBlocked.status).toBe(429);

      // OPTIONS must still succeed
      const opt = await request(testApp).options('/api/data');
      expect(opt.status).toBe(204);
      expect(opt.headers['ratelimit-remaining']).toBeUndefined();
    });

    it('leaves health checks completely unthrottled', async () => {
      const health = await request(testApp).get('/health');
      expect(health.status).toBe(200);
      expect(health.headers['ratelimit-remaining']).toBeUndefined();
    });

    it('leaves static assets completely unthrottled', async () => {
      const asset = await request(testApp).get('/assets/style.css');
      expect(asset.status).toBe(200);
      expect(asset.headers['ratelimit-remaining']).toBeUndefined();
    });

    it('allows GET requests through mutation limiter without consuming tokens', async () => {
      // Send 5 GETs to mutation-limited endpoint
      for (let i = 0; i < 5; i++) {
        const res = await request(testApp).get('/api/mutate');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-remaining']).toBeUndefined();
      }

      // First POST consumes 1 of 2 tokens
      const p1 = await request(testApp).post('/api/mutate');
      expect(p1.status).toBe(200);
      expect(p1.headers['ratelimit-remaining']).toBe('1');

      // Second POST consumes 2 of 2 tokens
      const p2 = await request(testApp).post('/api/mutate');
      expect(p2.status).toBe(200);
      expect(p2.headers['ratelimit-remaining']).toBe('0');

      // Third POST is throttled (429)
      const p3 = await request(testApp).post('/api/mutate');
      expect(p3.status).toBe(429);
      expect(p3.body).toEqual({ error: 'error.too_many_requests' });
    });
  });

  describe('App-level CORS preflight and unthrottling', () => {
    it('directly answers preflight OPTIONS with 204 and CORS headers', async () => {
      const res = await request(app)
        .options('/api/v1/patients')
        .set('Origin', 'http://localhost:4000');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4000');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('directly answers preflight OPTIONS without origin with 204', async () => {
      const res = await request(app).options('/api/v1/patients');
      expect(res.status).toBe(204);
    });
  });
});
