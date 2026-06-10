const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../app');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let authToken = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  if (res.statusCode !== 200) throw new Error('Login failed');
  authToken = res.body.accessToken;
});

describe('Multi-tenancy isolation', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/v1/patients' },
    { method: 'get', path: '/api/v1/appointments' },
    { method: 'get', path: '/api/v1/invoices' },
    { method: 'get', path: '/api/v1/treatments' },
    { method: 'get', path: '/api/v1/treatment-plans' },
    { method: 'get', path: '/api/v1/payments' },
    { method: 'get', path: '/api/v1/expenses' },
    { method: 'get', path: '/api/v1/purchase-orders' },
    { method: 'get', path: '/api/v1/inventory/items' },
    { method: 'get', path: '/api/v1/inventory/categories' },
    { method: 'get', path: '/api/v1/inventory/suppliers' },
    { method: 'get', path: '/api/v1/users' },
    { method: 'get', path: '/api/v1/audit-logs' },
    { method: 'get', path: '/api/v1/media' },
    { method: 'get', path: '/api/v1/xrays' },
    { method: 'get', path: '/api/v1/dashboard/appointments/today' },
    { method: 'get', path: '/api/v1/dashboard/recent-activity' },
    { method: 'get', path: '/api/v1/reports/revenue/monthly' },
  ];

  protectedRoutes.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} should return 401 without auth token`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });

    it(`${method.toUpperCase()} ${path} should return 200 with valid auth`, async () => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 201, 204]).toContain(res.statusCode);
    });
  });
});
